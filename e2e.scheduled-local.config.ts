import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";

export default {
  tests: "apps/observatory/e2e/scheduled-local.e2e.ts",
  targets: [
    {
      name: "local-scheduled",
      engine: web(),
      app: { url: "http://127.0.0.1:7412" },
    },
  ],
  secrets: { viewer: () => "local-scheduled-viewer" },
  workers: 1,
  cache: "off",
  trace: "retain-on-failure",
  output: ".e2e-scheduled-local",
} satisfies E2EConfig;
