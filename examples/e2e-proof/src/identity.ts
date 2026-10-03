import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// All inputs to this small reference, including its pinned dependency lock.
export function sourceIdentity() {
  const files = ["src/server.ts", "src/identity.ts", "tests/helpers.ts", "tests/selection.ts",
    "tests/selected-state.probe.ts", "tests/selected-state.e2e.ts", "e2e.config.ts",
    "e2e.probes.config.ts", "src/report-policy.ts", "src/report-policy.test.ts",
    "scripts/run.ts", "scripts/verify.ts", "fixtures/green-exploration.json",
    "tsconfig.json", "package.json", "bun.lock"];
  const hash = createHash("sha256");
  for (const file of files) hash.update(file).update(readFileSync(file));
  return { checkout: resolve("."), digest: hash.digest("hex") };
}
