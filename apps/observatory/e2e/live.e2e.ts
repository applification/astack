import { test } from "@e2e-dev/web";
import { expect, secrets } from "e2e";
test("private deployment gates access and supports live run/trace/work/skills navigation", async ({
  app,
  screen,
  browser,
}) => {
  await app.open();
  await expect(
    screen.getByRole("heading", "Private Observatory"),
  ).toBeVisible();
  await expect(screen.getByRole("heading", "Agent runs")).toHaveCount(0);
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  expect(
    await browser.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    ),
  ).toBe("dark");
  await screen.getByLabel("Private access key").fill(secrets.get("viewer"));
  await screen.getByRole("button", "Open Observatory").tap();
  await expect(screen.getByRole("heading", "Agent runs")).toBeVisible();
  await expect(screen.getByText("runs loaded")).toBeVisible();
  await screen.getByLabel("Agent").fill("codex");
  await expect(
    screen.getByRole("columnheader", "Agent / machine"),
  ).toBeVisible();
  await screen
    .getByRole("link", /Codex turn/)
    .first()
    .tap();
  await expect(screen.getByRole("heading", "Activity trace")).toBeVisible();
  await expect(
    screen.getByRole("heading", "Skills, instructions & workflows"),
  ).toBeVisible();
  await screen.getByRole("link", "Work", { exact: true }).tap();
  await expect(
    screen.getByRole("heading", "Work & agent activity"),
  ).toBeVisible();
  await screen.getByRole("link", "Skills & workflows", { exact: true }).tap();
  await expect(screen.getByRole("heading", "Skills & workflows")).toBeVisible();
  await screen.getByRole("table").getByRole("link").first().tap();
  await expect(screen.getByRole("heading", "Agent runs")).toBeVisible();
  expect(
    await browser.evaluate(() =>
      new URLSearchParams(location.hash.split("?")[1]).has("capability"),
    ),
  ).toBe(true);
  await screen.getByRole("link", "Problems", { exact: true }).tap();
  await expect(
    screen.getByRole("heading", "Problems & patterns"),
  ).toBeVisible();
  await screen.getByRole("link", "Capture health", { exact: true }).tap();
  await expect(screen.getByRole("heading", "Capture health")).toBeVisible();
  await expect(
    screen.getByRole("heading", "Machines with ingested records"),
  ).toBeVisible();
  await screen.getByLabel("Color theme").selectOption({ value: "light" });
  expect(
    await browser.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    ),
  ).toBe("light");
  expect(await browser.evaluate(() => Object.keys(localStorage))).toEqual([
    "astack-observatory-theme",
  ]);
});
