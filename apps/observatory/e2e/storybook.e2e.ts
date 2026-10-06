import { test } from "@e2e-dev/web";
import { expect } from "e2e";
test("trace expands failure evidence, preserves unknown times and filters failures", async ({
  app,
  screen,
  browser,
}) => {
  await app.open("/iframe.html?id=observatory-trace--mixed&viewMode=story");
  await screen.getByLabel("Color theme").selectOption({ value: "light" });
  await expect(screen.getByRole("heading", "Activity trace")).toBeVisible();
  await screen.getByText("Test/check result", { exact: true }).tap();
  await expect(
    screen.getByText("Content was not captured for this event.", {
      exact: true,
    }),
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
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  await app.screenshot("trace-failure-dark");
  await browser.setViewport({ width: 390, height: 844 });
  await expect(screen.getByRole("heading", "Activity trace")).toBeVisible();
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("readable trace content defaults on, hides completely and remembers the choice after reload", async ({
  app,
  screen,
  browser,
}) => {
  const path = "/iframe.html?id=observatory-trace--readable&viewMode=story";
  await app.open(path);
  await expect(
    screen.getByText(
      "Fix the checkout test so it accepts an expired session.",
      { exact: true, visible: true },
    ),
  ).toBeVisible();
  await expect(
    screen.getByText("bun test checkout --token [REDACTED]", {
      exact: true,
      visible: true,
    }),
  ).toBeVisible();
  await screen.getByText("Test/check result", { exact: true }).tap();
  await expect(
    screen.getByText("Checkout assertion failed: expected 200, received 401.", {
      exact: false,
    }),
  ).toBeVisible();
  await screen.getByLabel("Show content").uncheck();
  expect(
    await browser.evaluate(() =>
      document.body.textContent?.includes("expired session"),
    ),
  ).toBe(false);
  expect(
    await browser.evaluate(() =>
      document.body.textContent?.includes("bun test checkout"),
    ),
  ).toBe(false);
  expect(
    await browser.evaluate(() =>
      document.body.textContent?.includes("expected 200"),
    ),
  ).toBe(false);
  await expect(
    screen.getByText('"exitCode": 1', { exact: false }),
  ).toBeVisible();
  await app.screenshot("trace-content-hidden");
  await app.restart();
  await app.open(path);
  expect(
    await browser.evaluate(() =>
      document.body.textContent?.includes("expired session"),
    ),
  ).toBe(false);
  expect(
    await browser.evaluate(() =>
      localStorage.getItem("astack-observatory-show-content"),
    ),
  ).toBe("hide");
  await screen.getByLabel("Show content").check();
  await expect(
    screen.getByText(
      "Fix the checkout test so it accepts an expired session.",
      { exact: true, visible: true },
    ),
  ).toBeVisible();
  await screen.getByText("Test/check result", { exact: true }).tap();
  await expect(
    screen.getByText("Checkout assertion failed: expected 200, received 401.", {
      exact: false,
    }),
  ).toBeVisible();
  await app.screenshot("trace-content-readable");
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  await browser.setViewport({ width: 390, height: 844 });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
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
  await screen.getByLabel("Color theme").selectOption({ value: "light" });
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

test("theme choice survives reload and system mode follows the browser", async ({
  app,
  screen,
  browser,
}) => {
  await app.open("/iframe.html?id=observatory-runs--mixed&viewMode=story");
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  expect(
    await browser.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    ),
  ).toBe("dark");
  await expect(screen.getByText("Turn completed")).toBeVisible();
  await app.screenshot("runs-dark");
  await app.restart();
  await app.open("/iframe.html?id=observatory-runs--mixed&viewMode=story");
  expect(
    await browser.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    ),
  ).toBe("dark");
  await browser.setViewport({ width: 390, height: 844 });
  await app.screenshot("runs-narrow-dark");
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await screen.getByLabel("Color theme").selectOption({ value: "system" });
  expect(
    await browser.evaluate(
      () =>
        document.documentElement.getAttribute("data-theme") ===
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    ),
  ).toBe(true);
  expect(
    await browser.evaluate(() =>
      Object.keys(localStorage).filter(
        (key) => key !== "@storybook/manager/store",
      ),
    ),
  ).toEqual(["astack-observatory-theme"]);
});
