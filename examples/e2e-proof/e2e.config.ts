import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { sourceIdentity } from "./src/identity";

export const runId = process.env.REFERENCE_RUN_ID ?? "manual-reference";
export const source = sourceIdentity();

export default {
  output: process.env.REFERENCE_OUTPUT ?? ".e2e/manual",
  tests: "tests/*.e2e.ts",
  targets: [{
    name: "desktop",
    engine: web({ viewport: { width: 1000, height: 700 } }),
    app: {
      url: "http://127.0.0.1:0",
      identity: "astack-e2e-reference",
      environment: "test",
      command: {
        executable: "bun",
        args: ["src/server.ts", "{port}"],
        env: {
          REFERENCE_RUN_ID: runId,
          REFERENCE_SOURCE: source.digest,
          REFERENCE_VARIANT: process.env.REFERENCE_VARIANT ?? "fixed",
          REFERENCE_WRONG_INSTANCE: process.env.REFERENCE_WRONG_INSTANCE ?? "0",
        },
      },
    },
  }],
  workers: 1,
  retries: 0,
  timeout: 15000,
  assertionTimeout: 1500,
  trace: "on",
  reporters: ["list", "markdown", "junit"],
} satisfies E2EConfig;
