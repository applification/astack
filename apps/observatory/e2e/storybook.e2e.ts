import { test } from "@e2e-dev/web";
import { expect } from "e2e";
test("trace expands failure evidence, preserves unknown times and filters failures", async ({
  app,
  screen,
  browser,
}) => {
  await app.open("/iframe.html?id=observatory-trace--mixed&viewMode=story");
  await expect(screen.getByRole("heading", "Activity trace")).toBeVisible();
  await screen.getByText("Test/check result", { exact: true }).tap();
  await expect(
    screen.getByText('"output": "[WITHHELD]"', { exact: false }),
  ).toBeVisible();
  await expect(screen.getByText("Time unavailable")).toHaveCount(3);
  await screen.getByLabel("Failures and interventions only").check();
  await expect(
    screen.getByText("Test/check result", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("Skill read: convex-expert", { exact: true }),
  ).toHaveCount(0);
  await screen.getByLabel("Failures and interventions only").uncheck();
  await app.screenshot("trace-failure-expanded");
  await browser.setViewport({ width: 390, height: 844 });
  await expect(screen.getByRole("heading", "Activity trace")).toBeVisible();
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("empty and privacy stories render without inventing data", async ({
  app,
  screen,
}) => {
  await app.open("/iframe.html?id=observatory-trace--empty&viewMode=story");
  await expect(screen.getByText("No events captured yet.")).toBeVisible();
  await app.open(
    "/iframe.html?id=observatory-trace--missing-time-and-privacy&viewMode=story",
  );
  await screen.getByText("Skill read: convex-expert", { exact: true }).tap();
  await expect(
    screen.getByText("convex-expert · 0123456789ab · observation time · read", {
      exact: true,
    }),
  ).toBeVisible();
});
test("runs design renders readable status, work links and machine context", async ({
  app,
  screen,
  browser,
}) => {
  await app.open("/iframe.html?id=observatory-runs--mixed&viewMode=story");
  await expect(screen.getByRole("heading", "Agent runs")).toBeVisible();
  await expect(screen.getByText("Turn completed")).toBeVisible();
  await expect(screen.getByText("No completion observed")).toBeVisible();
  await expect(screen.getByRole("link", "Work AST-fixture")).toHaveCount(3);
  await app.screenshot("runs-mixed");
  await browser.setViewport({ width: 390, height: 844 });
  await expect(screen.getByRole("heading", "Agent runs")).toBeVisible();
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await app.screenshot("runs-narrow");
});
