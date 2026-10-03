import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { sourceIdentity } from "../src/identity";

export async function runCheck(mode: "probe" | "regression", options: {
  variant?: "buggy" | "fixed"; rerunOf?: string; wrongInstance?: boolean; target?: string;
} = {}) {
  const root = resolve(import.meta.dir, "..");
  if (process.cwd() !== root) throw new Error("Run from examples/e2e-proof");
  const id = randomUUID();
  const output = resolve(".e2e/runs", `${mode}-${id}`);
  mkdirSync(output, { recursive: true });
  let seed: string | undefined;
  if (options.rerunOf) {
    seed = readFileSync(resolve(options.rerunOf, "report.json"), "utf8");
    writeFileSync(resolve(output, "report.json"), seed);
  }
  const git = (args: string[]) => {
    const child = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
    if (child.exitCode !== 0) throw new Error("Cannot identify source revision");
    return child.stdout.toString().trim();
  };
  const identity = { commit: git(["rev-parse", "HEAD"]), dirty: !!git(["status", "--porcelain"]),
    ...sourceIdentity(), runId: id, variant: options.variant ?? "fixed", mode,
    rerunOf: options.rerunOf, startedAt: new Date().toISOString(), actor: "anonymous",
    fixture: "disposable selection preview", target: options.target ?? "desktop" };
  writeFileSync(resolve(output, "identity.json"), JSON.stringify(identity, null, 2) + "\n");
  const child = Bun.spawn(["bunx", "--no-install", "e2e", "run", "--config",
    mode === "probe" ? "e2e.probes.config.ts" : "e2e.config.ts",
    "--target", identity.target, ...(options.rerunOf ? ["--last-failed"] : [])], {
    cwd: root, stdout: "inherit", stderr: "inherit", env: { ...process.env,
      E2E_TELEMETRY_DISABLED: "1", REFERENCE_RUN_ID: id,
      REFERENCE_OUTPUT: relative(root, output), REFERENCE_VARIANT: identity.variant,
      REFERENCE_WRONG_INSTANCE: options.wrongInstance ? "1" : "0" },
  });
  const stop = () => child.kill();
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  const exitCode = await child.exited;
  process.off("SIGINT", stop); process.off("SIGTERM", stop);
  const reportPath = resolve(output, "report.json");
  if (seed && existsSync(reportPath) && readFileSync(reportPath, "utf8") === seed) {
    renameSync(reportPath, resolve(output, "selection-report.json"));
  }
  const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : undefined;
  writeFileSync(resolve(output, "identity.json"), JSON.stringify({ ...identity, exitCode,
    reportSha256: existsSync(reportPath) ? createHash("sha256").update(readFileSync(reportPath)).digest("hex") : null }, null, 2) + "\n");
  return { output, exitCode, report };
}

if (import.meta.main) {
  const mode = process.argv[2];
  if (mode !== "probe" && mode !== "regression") throw new Error("Expected probe or regression");
  process.exitCode = (await runCheck(mode)).exitCode;
}
