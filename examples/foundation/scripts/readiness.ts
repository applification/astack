import assert from "node:assert/strict";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Browser } from "playwright";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { HttpTransport } from "./http-transport";
import {
  command,
  foundationRoot,
  redact,
  revisionIdentity,
  startRuntime,
  waitFor,
  type Runtime,
} from "./runtime";
import { startMcpHost } from "./mcp-host";

type WorkItem = { id: string; title: string; status: "open" | "done" };
type Check = {
  id: string;
  surface: string;
  outcome: "pass" | "fail" | "inconclusive" | "skipped";
  observation: string;
};
export type ReadinessReport = {
  format: "astack-foundation-readiness/v1";
  startedAt: string;
  finishedAt: string;
  revision: string;
  outcome: "pass" | "fail" | "inconclusive";
  environment: Record<string, string>;
  checks: Check[];
  artifacts: string[];
  cleanup: "complete" | "failed";
  error?: string;
};
const list = makeFunctionReference<"query">("workItems:list");
const setStatus = makeFunctionReference<"mutation">("workItems:setStatus");
const workItemsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    status: z.enum(["open", "done"]),
  }),
);
export function items(value: unknown): WorkItem[] {
  return workItemsSchema.parse(value);
}
export function selfContainedResource(html: string): void {
  assert.ok(
    html.includes("<html") || html.includes("<!doctype"),
    "UI resource is not an HTML document",
  );
  assert.ok(
    !/<script\b[^>]*\bsrc\s*=/i.test(html),
    "UI depends on external script files",
  );
  assert.ok(
    !/<link\b[^>]*\brel\s*=\s*["']?stylesheet/i.test(html),
    "UI depends on external CSS files",
  );
  assert.ok(
    !/https?:\/\/[^\s"']+\.(?:js|css)(?:["'\s?]|$)/i.test(html),
    "UI depends on remote assets",
  );
}
async function denied(operation: () => Promise<unknown>): Promise<void> {
  let rejected = false;
  try {
    const value = await operation();
    rejected =
      !!value &&
      typeof value === "object" &&
      "isError" in value &&
      value.isError === true;
  } catch {
    rejected = true;
  }
  assert.ok(rejected, "Unauthorized operation unexpectedly succeeded");
}
async function connect(runtime: Runtime, bearer: string): Promise<Client> {
  const client = new Client({
    name: "astack-foundation-proof",
    version: "1.0.0",
  });
  await client.connect(
    new HttpTransport(new URL(runtime.mcpUrl), {
      requestInit: { headers: { authorization: `Bearer ${bearer}` } },
    }),
  );
  return client;
}

export async function doctor(projectRoot = foundationRoot) {
  const results = await Promise.allSettled([
    command(["bun", "--version"], projectRoot),
    command(["node", "--version"], projectRoot),
    access(join(projectRoot, "node_modules")),
    access(join(projectRoot, "bun.lock")),
  ]);
  return {
    checkout: resolve(projectRoot),
    revision: await revisionIdentity(projectRoot),
    ready: results.every((result) => result.status === "fulfilled"),
    target: null,
    observations: results.map((result, index) => ({
      prerequisite: [
        "Bun",
        "Node",
        "installed dependencies",
        "frozen dependency lock",
      ][index],
      outcome: result.status === "fulfilled" ? "pass" : "fail",
      detail:
        result.status === "fulfilled"
          ? (result.value ?? "present").trim()
          : redact(String(result.reason)),
    })),
    scope:
      "Read-only checkout inspection. A live disposable target is created only by verify.",
  };
}

export async function verify(
  options: {
    projectRoot?: string;
    evidenceDirectory?: string | undefined;
  } = {},
): Promise<ReadinessReport> {
  const projectRoot = options.projectRoot ?? foundationRoot;
  const evidence = resolve(
    options.evidenceDirectory ??
      join(
        projectRoot,
        ".proof",
        new Date().toISOString().replace(/[:.]/g, "-"),
      ),
  );
  await mkdir(evidence, { recursive: true });
  const report: ReadinessReport = {
    format: "astack-foundation-readiness/v1",
    startedAt: new Date().toISOString(),
    finishedAt: "",
    revision: await revisionIdentity(projectRoot),
    outcome: "inconclusive",
    environment: {},
    checks: [],
    artifacts: [],
    cleanup: "complete",
  };
  let runtime: Runtime | undefined,
    browser: Browser | undefined,
    mcp: Client | undefined,
    otherMcp: Client | undefined;
  let host: Awaited<ReturnType<typeof startMcpHost>> | undefined;
  const check = async <T>(
    id: string,
    surface: string,
    observation: string,
    action: () => Promise<T>,
  ): Promise<T> => {
    try {
      const value = await action();
      report.checks.push({ id, surface, outcome: "pass", observation });
      return value;
    } catch (error) {
      report.checks.push({
        id,
        surface,
        outcome: "fail",
        observation: redact(String(error)),
      });
      throw error;
    }
  };
  try {
    runtime = await startRuntime({ projectRoot });
    const active = runtime;
    report.environment = {
      kind: "disposable local Convex + Vite + Chromium",
      buildId: runtime.buildId,
      web: runtime.webUrl,
      convex: runtime.convexUrl,
      mcp: runtime.mcpUrl,
      actors: "proof-owner-a, proof-owner-b",
      credentialPolicy:
        "Ephemeral signed RS256 JWTs; no token or private key written to evidence",
    };
    browser = await chromium.launch();
    const liveBrowser = browser;
    const page = await liveBrowser.newPage();
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await check(
      "R1",
      "identity",
      "Running backend health and web identify this revision and local proof environment.",
      async () => {
        const health = (await (
          await fetch(`${active.siteUrl}/health`)
        ).json()) as { buildId: string; resource: string; authMode: string };
        assert.equal(health.buildId, active.buildId);
        assert.equal(health.resource, active.mcpUrl);
        assert.equal(health.authMode, "local-proof");
        await page.goto(active.webUrl);
        await page
          .getByRole("heading", { name: "Work items", exact: true })
          .waitFor();
        await page.locator(`[data-build-id="${active.buildId}"]`).waitFor();
      },
    );
    const title = `Proof item ${Date.now()}`;
    const owner = new ConvexHttpClient(runtime.convexUrl);
    owner.setAuth(runtime.tokens.web);
    const item = await check(
      "R2",
      "web → persistence",
      "Creating through the web is visible in a fresh authenticated Convex read.",
      async () => {
        await page.getByLabel("Title", { exact: true }).fill(title);
        await page
          .getByRole("button", { name: "Add work item", exact: true })
          .click();
        await page.getByText(title, { exact: true }).waitFor();
        return waitFor(
          async () =>
            items(await owner.query(list, {})).find(
              (item) => item.title === title,
            ) ?? false,
          "persisted web item",
        );
      },
    );
    mcp = await connect(runtime, runtime.tokens.mcp);
    const ownerMcp = mcp;
    await check(
      "R3",
      "MCP → web",
      "A status change through the actual MCP endpoint survives a fresh read and web reload.",
      async () => {
        const tools = await ownerMcp.listTools();
        for (const name of [
          "work_items_list",
          "work_items_create",
          "work_items_set_status",
          "work_items_delete",
        ])
          assert.ok(
            tools.tools.some((tool) => tool.name === name),
            `Missing ${name}`,
          );
        const result = await ownerMcp.callTool({
          name: "work_items_set_status",
          arguments: { id: item.id, status: "done" },
        });
        assert.notEqual(result.isError, true);
        assert.equal(
          items(await owner.query(list, {})).find(
            (value) => value.id === item.id,
          )?.status,
          "done",
        );
        await page.reload();
        await page.getByText(title, { exact: true }).waitFor();
        await page
          .getByRole("button", { name: "Reopen", exact: true })
          .waitFor();
      },
    );
    await check(
      "R4",
      "authorization",
      "Another signed user cannot read or mutate the first user’s item through Convex or MCP.",
      async () => {
        const other = new ConvexHttpClient(active.convexUrl);
        other.setAuth(active.tokens.otherWeb);
        assert.equal(
          items(await other.query(list, {})).some(
            (value) => value.id === item.id,
          ),
          false,
        );
        await denied(() =>
          other.mutation(setStatus, { id: item.id, status: "open" }),
        );
        const secondMcp = await connect(active, active.tokens.otherMcp);
        otherMcp = secondMcp;
        await denied(() =>
          secondMcp.callTool({
            name: "work_items_set_status",
            arguments: { id: item.id, status: "open" },
          }),
        );
        await denied(() =>
          secondMcp.callTool({
            name: "work_items_delete",
            arguments: { id: item.id },
          }),
        );
        assert.equal(
          items(await owner.query(list, {})).find(
            (value) => value.id === item.id,
          )?.status,
          "done",
        );
      },
    );
    await check(
      "R5",
      "authentication",
      "MCP denies anonymous, web-audience, wrong-audience and expired credentials; Convex denies anonymous/wrong-audience reads.",
      async () => {
        for (const bearer of [
          undefined,
          active.tokens.web,
          active.tokens.wrongAudience,
          active.tokens.expired,
        ]) {
          const response = await fetch(active.mcpUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json, text/event-stream",
              ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "initialize",
              params: {
                protocolVersion: "2025-03-26",
                capabilities: {},
                clientInfo: { name: "negative-proof", version: "1" },
              },
            }),
          });
          assert.equal(
            response.status,
            401,
            "MCP did not reject invalid identity",
          );
        }
        await denied(() =>
          new ConvexHttpClient(active.convexUrl).query(list, {}),
        );
        const wrong = new ConvexHttpClient(active.convexUrl);
        wrong.setAuth(active.tokens.wrongAudience);
        await denied(() => wrong.query(list, {}));
      },
    );
    await check(
      "R6",
      "MCP contracts",
      "Malformed status arguments are rejected and the UI resource contains its required JS/CSS.",
      async () => {
        await denied(() =>
          ownerMcp.callTool({
            name: "work_items_set_status",
            arguments: { id: item.id, status: "unknown" },
          }),
        );
        const resource = await ownerMcp.readResource({
          uri: "ui://foundation/work-items.html",
        });
        const content = resource.contents[0];
        assert.ok(content && "text" in content);
        assert.equal(content.mimeType, "text/html;profile=mcp-app");
        selfContainedResource(content.text);
      },
    );
    await page.screenshot({
      path: join(evidence, "web-persisted.png"),
      fullPage: true,
    });
    report.artifacts.push("web-persisted.png");
    await check(
      "R7",
      "local MCP App host",
      "The real MCP resource renders inside a sandboxed iframe through AppBridge connected to the running MCP endpoint.",
      async () => {
        host = await startMcpHost(active);
        const appPage = await liveBrowser.newPage();
        await appPage.goto(host.url);
        await appPage
          .getByRole("status")
          .filter({ hasText: "Connected to the running MCP server" })
          .waitFor();
        await appPage
          .frameLocator("#app")
          .getByText(title, { exact: true })
          .waitFor();
        await appPage.screenshot({
          path: join(evidence, "mcp-app-host.png"),
          fullPage: true,
        });
        report.artifacts.push("mcp-app-host.png");
        await appPage.close();
      },
    );
    await check(
      "R8",
      "web runtime",
      "No uncaught web JavaScript error was observed during the create/reload journey.",
      () =>
        Promise.resolve().then(() => {
          assert.deepEqual(consoleErrors, []);
        }),
    );
    report.checks.push(
      {
        id: "G1",
        surface: "WorkOS",
        outcome: "skipped",
        observation:
          "Disposable issuer verifies auth boundaries. Live WorkOS sign-in, refresh and organization lifecycle require a configured test tenant.",
      },
      {
        id: "G2",
        surface: "ChatGPT",
        outcome: "skipped",
        observation:
          "Local AppBridge host was exercised. Installed ChatGPT OAuth, tool selection and UI behavior were not run.",
      },
    );
    report.outcome = "pass";
  } catch (error) {
    report.error = redact(String(error));
    report.outcome = report.checks.some((check) => check.outcome === "fail")
      ? "fail"
      : "inconclusive";
    if (!runtime)
      report.checks.push({
        id: "setup",
        surface: "runtime",
        outcome: "inconclusive",
        observation: report.error,
      });
  } finally {
    try {
      await otherMcp?.close();
      await mcp?.close();
      await host?.stop();
      await browser?.close();
      await runtime?.stop();
    } catch (error) {
      report.cleanup = "failed";
      report.outcome = "inconclusive";
      report.error = `${report.error ?? ""}\nCleanup: ${redact(String(error))}`;
    }
    if (runtime) {
      await writeFile(
        join(evidence, "runtime.log"),
        redact(runtime.logs.join("")),
      );
      report.artifacts.push("runtime.log");
    }
    report.finishedAt = new Date().toISOString();
    await writeFile(
      join(evidence, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
  }
  return report;
}

if (import.meta.main) {
  if (process.argv.includes("--doctor")) {
    console.log(JSON.stringify(await doctor(), null, 2));
  } else {
    const index = process.argv.indexOf("--evidence");
    const report = await verify({
      evidenceDirectory: index >= 0 ? process.argv[index + 1] : undefined,
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.outcome !== "pass") process.exitCode = 1;
  }
}
