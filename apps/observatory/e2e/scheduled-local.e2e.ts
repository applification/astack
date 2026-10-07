import { test } from "@e2e-dev/web";
import { expect, secrets } from "e2e";
import { readFileSync } from "node:fs";
import { z } from "zod";

const fixture = z
  .object({ projectId: z.string(), latestRunId: z.string() })
  .parse(
    JSON.parse(
      readFileSync(".proof/observatory-scheduled/local/results.json", "utf8"),
    ),
  );

test("persisted scheduled tasks open exact project and machine history through the real reactive app", async ({
  app,
  screen,
  browser,
}) => {
  await app.open("/#scheduled?project=" + fixture.projectId);
  await screen.getByLabel("Private access key").fill(secrets.get("viewer"));
  await screen.getByRole("button", "Open Observatory").tap();
  await expect(
    screen.getByRole("heading", "Scheduled tasks", { exact: true }),
  ).toBeVisible();
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const table = screen.getByRole("region", "Scheduled tasks table", {
    exact: true,
  });
  await expect(table.getByRole("row")).toHaveCount(5);
  const desktop = table
    .getByRole("row")
    .filter({ hasText: "daily-health" })
    .filter({ hasText: "Fixture desktop" });
  await expect(desktop.getByRole("cell", "2", { exact: true })).toBeVisible();
  await desktop.getByRole("link", "View task history").tap();
  await expect(
    screen.getByRole("heading", "Agent runs", { exact: true }),
  ).toBeVisible();
  const history = screen.getByRole("region", "Agent runs table", {
    exact: true,
  });
  await expect(history.getByRole("row")).toHaveCount(3);
  await expect(
    history.getByRole("link", "Scheduled task: Daily health scan"),
  ).toHaveCount(2);
  await expect(history).toContainText("Fixture desktop");
  await expect(history).not.toContainText("Fixture laptop");
  await screen.getByRole("link", "Scheduled tasks", { exact: true }).tap();
  await table
    .getByRole("row")
    .filter({ hasText: "daily-health" })
    .filter({ hasText: "Fixture desktop" })
    .getByRole("link", /^Run ·/)
    .tap();
  await expect(browser).toHaveURL(
    new RegExp("#run/" + encodeURIComponent(fixture.latestRunId)),
  );
  await expect(
    screen.getByRole("heading", "Scheduled activity latest", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("Daily health scan", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("Daily · 09:00", { exact: true }),
  ).toBeVisible();
  await browser.reload();
  await expect(
    screen.getByText("Daily health scan", { exact: true }),
  ).toBeVisible();
  await screen.getByRole("link", "Runs", { exact: true }).tap();
  await screen.getByRole("button", "Filters", { exact: true }).tap();
  await screen
    .getByLabel("Run type", { exact: true })
    .selectOption({ label: "Scheduled tasks" });
  await expect(
    screen.getByRole("region", "Agent runs table").getByRole("row"),
  ).toHaveCount(6);
  await screen.getByRole("button", "Clear filters", { exact: true }).tap();
  await expect(
    screen.getByRole("region", "Agent runs table").getByRole("row"),
  ).toHaveCount(7);
  await screen.getByRole("link", "Scheduled tasks", { exact: true }).tap();
  await browser.setViewport({ width: 390, height: 844 });
  await expect(table).toBeVisible();
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
