import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  configureNaming,
  generateNames,
  nameActivities,
  namingConfigSchema,
} from "./naming";

async function fixture(mode: "valid" | "wrong-key" | "hang" = "valid") {
  const directory = await mkdtemp(join(tmpdir(), "astack-names-test-"));
  const binary = join(directory, "fake-codex");
  await writeFile(
    binary,
    `#!/usr/bin/env bun
const args = process.argv.slice(2);
const input = await Bun.stdin.text();
await Bun.write(${JSON.stringify(join(directory, "invocation.json"))}, JSON.stringify({ args, input, cwd: process.cwd(), envHasKey: !!process.env.OPENAI_API_KEY }));
${
  mode === "hang"
    ? "await new Promise(() => {});"
    : `const batch = JSON.parse(input.slice(input.indexOf('[{')));
await Bun.write(args[args.indexOf('--output-last-message') + 1], JSON.stringify({ names: batch.map(item => ({key: ${mode === "wrong-key" ? '"wrong-key"' : "item.key"}, title: 'Name Work and activities'})) }));`
}
`,
    { mode: 0o700 },
  );
  await chmod(binary, 0o700);
  return {
    directory,
    config: {
      codexBinary: binary,
      codexHome: join(directory, "auth-home"),
      model: "gpt-6-luna",
    },
  };
}
const inputs = [
  {
    key: "fixture-activity",
    kind: "activity" as const,
    requests: ["Add Work headings; $(touch /tmp/not-a-command) is source text"],
  },
];

test("naming sends text over stdin in an ephemeral isolated Codex process, validates output and cleans temporary files", async () => {
  const { directory, config } = await fixture();
  try {
    const result = await generateNames(config, inputs, {
      signal: new AbortController().signal,
    });
    expect(result.names[0]?.title).toBe("Name Work and activities");
    const invocation = JSON.parse(
      await readFile(join(directory, "invocation.json"), "utf8"),
    );
    expect(invocation.input).toContain(inputs[0]!.requests[0]);
    expect(invocation.args).toContain("--ephemeral");
    expect(invocation.args).toContain("--ignore-user-config");
    expect(invocation.args).toContain('forced_login_method="chatgpt"');
    expect(invocation.args).toContain("shell_tool");
    expect(invocation.envHasKey).toBe(false);
    expect(invocation.cwd).not.toContain("worktrees");
    expect(await Bun.file(join(invocation.cwd, "result.json")).exists()).toBe(
      false,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("naming rejects wrong result keys, cancels on shutdown and kills timed-out inference", async () => {
  const invalid = await fixture("wrong-key");
  const hanging = await fixture("hang");
  try {
    await expect(
      generateNames(invalid.config, inputs, {
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("does not match");
    await expect(
      generateNames(hanging.config, inputs, {
        signal: new AbortController().signal,
        timeoutMs: 100,
      }),
    ).rejects.toThrow("naming_timeout");
    const controller = new AbortController();
    const result = generateNames(hanging.config, inputs, {
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 100);
    await expect(result).rejects.toThrow("naming_cancelled");
  } finally {
    await rm(invalid.directory, { recursive: true, force: true });
    await rm(hanging.directory, { recursive: true, force: true });
  }
});
test("the independent worker authenticates as owner, batches claims and publishes structured names", async () => {
  const { directory, config } = await fixture();
  const calls: string[] = [];
  const claim = crypto.randomUUID();
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/auth/session") {
        expect(request.headers.get("authorization")).toBe(
          "Bearer fixture-owner-key",
        );
        return Response.json({ token: "fixture-jwt" });
      }
      expect(request.headers.get("authorization")).toBe("Bearer fixture-jwt");
      const body = await request.json();
      calls.push(body.path);
      if (body.path === "naming:backfill") {
        expect(body.args[0].paginationOpts).toEqual({
          cursor: null,
          numItems: 3,
        });
        return Response.json({
          status: "success",
          value: { continueCursor: "fixture-cursor", isDone: true, count: 3 },
          logLines: [],
        });
      }
      if (body.path === "naming:claim")
        return Response.json({
          status: "success",
          value: [{ ...inputs[0], claim }],
          logLines: [],
        });
      if (body.path === "naming:complete") {
        expect(body.args[0].model).toBe("gpt-6-luna");
        expect(body.args[0].names).toEqual([
          { key: "fixture-activity", claim, title: "Name Work and activities" },
        ]);
        return Response.json({ status: "success", value: 1, logLines: [] });
      }
      return new Response("unexpected request", { status: 500 });
    },
  });
  try {
    const viewerTokenFile = join(directory, "viewer-token");
    await writeFile(viewerTokenFile, "fixture-owner-key\n", { mode: 0o600 });
    await configureNaming(
      directory,
      namingConfigSchema.parse({
        ...config,
        backendUrl: server.url.origin,
        authUrl: `${server.url.origin}/auth/session`,
        viewerTokenFile,
      }),
    );
    expect(
      await nameActivities(directory, {
        once: true,
        backfill: true,
        signal: new AbortController().signal,
      }),
    ).toEqual({ names: 1, scanned: 3 });
    expect(calls).toEqual([
      "naming:backfill",
      "naming:claim",
      "naming:complete",
    ]);
    expect(
      JSON.parse(
        await readFile(join(directory, "names-backfill.json"), "utf8"),
      ),
    ).toEqual({ cursor: "fixture-cursor", done: true });
    await nameActivities(directory, {
      once: true,
      backfill: true,
      signal: new AbortController().signal,
    });
    expect(calls.filter((path) => path === "naming:backfill")).toHaveLength(1);
    expect(
      namingConfigSchema.safeParse({
        ...config,
        backendUrl: "https://public.example.com",
        authUrl: `${server.url.origin}/auth/session`,
        viewerTokenFile,
      }).success,
    ).toBe(false);
  } finally {
    server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
});
