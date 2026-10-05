import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export default {
  tests: "apps/observatory/e2e/live.e2e.ts",
  targets: [
    {
      name: "private-otis",
      engine: web(),
      app: {
        url: "https://otis.tail12a0a0.ts.net:8450",
        environment: "production",
      },
    },
  ],
  secrets: {
    viewer: () =>
      readFileSync(
        process.env.OBSERVATORY_VIEWER_KEY_FILE ??
          join(homedir(), ".local/share/astack/observatory/viewer-access-key"),
        "utf8",
      ).trim(),
  },
  workers: 1,
  cache: "off",
  trace: "off",
  video: "off",
  output: ".e2e-live",
} satisfies E2EConfig;
