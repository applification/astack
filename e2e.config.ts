import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
export default {
  tests: "apps/observatory/e2e/storybook.e2e.ts",
  targets: [
    {
      name: "storybook",
      engine: web(),
      app: {
        url: "http://127.0.0.1:0",
        command: {
          executable: "bun",
          args: [
            "x",
            "--no-install",
            "vite",
            "preview",
            "--host",
            "127.0.0.1",
            "--port",
            "{port}",
            "--outDir",
            "storybook-static",
          ],
          cwd: "apps/observatory",
          log: ".e2e/logs/storybook.log",
        },
      },
    },
  ],
  workers: 1,
  cache: "off",
  trace: "retain-on-failure",
} satisfies E2EConfig;
