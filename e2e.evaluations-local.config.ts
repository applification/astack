import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";

// URL-only: the operator owns the anonymous backend and Vite instance.
export default {
  tests: "apps/observatory/e2e/evaluations-local.e2e.ts",
  targets: [
    {
      name: "local-evaluations",
      engine: web(),
      app: { url: "http://127.0.0.1:7410" },
    },
  ],
  secrets: { viewer: () => "local-evaluation-viewer" }, // Disposable fixture; never an Otis credential.
  workers: 1,
  cache: "off",
  trace: "retain-on-failure",
  output: ".e2e-evaluations-local",
} satisfies E2EConfig;
