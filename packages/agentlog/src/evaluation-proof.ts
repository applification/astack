import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  proofReportSchema,
  type ProofReport,
} from "@astack/agent-observability/evaluations";

export const proofVariantSchema = z.enum(["defective", "fixed", "unavailable"]);
export async function savedEditProof(
  variant: z.infer<typeof proofVariantSchema>,
  output: string,
): Promise<ProofReport> {
  const runId = crypto.randomUUID();
  const directory = join(resolve(output), runId);
  const scratch = join(directory, "scratch");
  await mkdir(scratch, { recursive: true, mode: 0o700 });
  const document = join(scratch, "document.json");
  await writeFile(document, JSON.stringify({ value: "Original edit" }));
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const headers = { "x-fixture-run": runId };
      if (variant === "unavailable")
        return new Response("Fixture unavailable", { status: 503, headers });
      if (request.method === "POST") {
        const input = z
          .object({ value: z.string() })
          .parse(await request.json());
        if (variant === "fixed")
          await writeFile(document, JSON.stringify(input));
        return Response.json(input, { headers });
      }
      return Response.json(JSON.parse(await readFile(document, "utf8")), {
        headers,
      });
    },
  });
  try {
    const commit = Bun.spawnSync(["git", "rev-parse", "HEAD"], {
      cwd: import.meta.dir,
    });
    if (commit.exitCode !== 0) throw new Error("Fixture revision unavailable");
    const status = Bun.spawnSync(["git", "status", "--porcelain"], {
      cwd: import.meta.dir,
    });
    if (status.exitCode !== 0)
      throw new Error("Fixture checkout identity unavailable");
    const sourceDigest = createHash("sha256");
    for (const source of [
      import.meta.filename,
      join(import.meta.dir, "../../agent-observability/src/evaluations.ts"),
      join(import.meta.dir, "../../../bun.lock"),
    ])
      sourceDigest.update(await readFile(source)).update("\0");
    const value = "Saved edit";
    const saved = await fetch(server.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value }),
    });
    const reopened = saved.ok ? await fetch(server.url) : null;
    const state = reopened?.ok
      ? z.object({ value: z.string() }).parse(await reopened.json())
      : null;
    const independent = JSON.parse(await readFile(document, "utf8"));
    const identity =
      saved.headers.get("x-fixture-run") === runId &&
      (!reopened || reopened.headers.get("x-fixture-run") === runId);
    const verdict =
      !identity || !saved.ok || !state
        ? "inconclusive"
        : state.value === value && independent.value === value
          ? "pass"
          : "fail";
    const observed =
      verdict === "pass"
        ? "Reopened document contains the saved edit."
        : verdict === "fail"
          ? "Reopened document contains the old value."
          : "Fixture unavailable; save/reopen could not be verified.";
    const artifactPath = join(directory, "observations.json");
    const artifact =
      JSON.stringify(
        {
          runId,
          saveStatus: saved.status,
          reopened: state,
          independent,
          identity,
          expected: value,
        },
        null,
        2,
      ) + "\n";
    await writeFile(artifactPath, artifact);
    const report = proofReportSchema.parse({
      schemaVersion: 1,
      revision: commit.stdout.toString().trim(),
      dirty: status.stdout.toString().trim().length > 0,
      sourceDigest: sourceDigest.digest("hex"),
      target: "Loopback saved-edit fixture / " + variant,
      actor: "fixture-owner",
      fixture: "Disposable document / " + runId,
      command: "agentlog evaluation demo-proof --variant " + variant,
      cases: [
        {
          caseId: "A1",
          attempts: [
            {
              status: verdict,
              observed,
              ...(state
                ? {
                    independentObservation:
                      "Fresh disk read: " + independent.value,
                  }
                : {}),
              artifacts: [
                {
                  label: "Save, reopen and independent disk observations",
                  path: artifactPath,
                  sha256: createHash("sha256").update(artifact).digest("hex"),
                },
              ],
            },
          ],
        },
      ],
    });
    await writeFile(
      join(directory, "proof.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    return report;
  } finally {
    server.stop(true);
    await rm(scratch, { recursive: true, force: true });
  }
}
