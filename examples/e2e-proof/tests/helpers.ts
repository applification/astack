import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { runId, source } from "../e2e.config";

test.beforeEach(async ({ app }) => {
  const response = await fetch(app.baseUrl!);
  expect(response.ok).toBe(true);
  expect(response.headers.get("x-reference-run")).toBe(runId);
  expect(response.headers.get("x-reference-source")).toBe(source.digest);
  await app.open("/");
});
export { test };
