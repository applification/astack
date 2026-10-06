import { test } from "@e2e-dev/web";
import { expect, secrets } from "e2e";
test("live project filter menus work across Runs, Work and Problems and find historical branch results", async ({
  app,
  screen,
  browser,
}) => {
  await app.open();
  await screen.getByLabel("Private access key").fill(secrets.get("viewer"));
  await screen.getByRole("button", "Open Observatory").tap();
  await expect(screen.getByRole("heading", "Agent runs")).toBeVisible();
  await screen.getByLabel("Selected project").selectOption({ label: "Astack" });
  await expect(
    screen.getByText("Loading filter choices…", { exact: true }),
  ).toHaveCount(0, { timeout: 30_000 });
  const branches = await screen
    .getByLabel("Branch", { exact: true })
    .getByRole("option")
    .count();
  expect(branches).toBeGreaterThan(1);
  await screen
    .getByLabel("Branch", { exact: true })
    .selectOption({ index: branches - 1 });
  await expect(
    screen.getByRole("region", "Agent runs table").getByRole("row").nth(1),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    screen.getByLabel("Branch", { exact: true }).getByRole("option"),
  ).toHaveCount(branches);
  await screen.getByRole("button", "Clear filters", { exact: true }).tap();
  for (const page of ["Runs", "Work", "Problems"]) {
    await screen.getByRole("link", page, { exact: true }).tap();
    expect(
      await browser.evaluate(
        () => document.querySelectorAll(".filters select").length,
      ),
    ).toBe(10);
    expect(
      await browser.evaluate(
        () => document.querySelectorAll('.filters input[type="text"]').length,
      ),
    ).toBe(0);
    await expect(
      screen.getByLabel("Status", { exact: true }).getByRole("option"),
    ).toHaveCount(6);
    await expect(
      screen.getByLabel("Work outcome", { exact: true }).getByRole("option"),
    ).toHaveCount(4);
    await screen
      .getByLabel("Agent", { exact: true })
      .selectOption({ value: "codex" });
    await expect(screen.getByLabel("Agent", { exact: true })).toHaveValue(
      "codex",
    );
    await screen.getByLabel("From date").fill("2026-10-01");
    await screen.getByRole("button", "Clear filters", { exact: true }).tap();
    await expect(screen.getByLabel("Agent", { exact: true })).toHaveValue("");
    await expect(screen.getByLabel("From date")).toHaveValue("");
  }
});
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
  await screen.getByLabel("Selected project").selectOption({ label: "Astack" });
  const selectedProject = await browser.evaluate(() =>
    new URLSearchParams(location.hash.split("?")[1]).get("project"),
  );
  expect(typeof selectedProject).toBe("string");
  await screen.getByLabel("Agent").selectOption({ value: "codex" });
  // Running turns can arrive before their queued events. Use a settled turn
  // for the separate content-visibility assertions below.
  await screen
    .getByLabel("Status", { exact: true })
    .selectOption({ value: "completed" });
  await expect(
    screen.getByRole("columnheader", "Agent / machine"),
  ).toBeVisible();
  await screen
    .getByRole("link", /Codex turn/)
    .first()
    .tap();
  await expect(screen.getByRole("heading", "Activity trace")).toBeVisible();
  expect(
    await browser.evaluate(() =>
      new URLSearchParams(location.hash.split("?")[1]).get("project"),
    ),
  ).toBe(selectedProject);
  await expect
    .poll(() =>
      browser.evaluate(() => document.querySelector(".event-preview") !== null),
    )
    .toBe(true);
  await screen.getByLabel("Show content").uncheck();
  expect(
    await browser.evaluate(
      () => document.querySelector(".event-preview") === null,
    ),
  ).toBe(true);
  await expect(
    screen.getByText(
      "Conversation and tool content is hidden on this screen. Capture continues privately.",
      { exact: true },
    ),
  ).toBeVisible();
  await screen.getByLabel("Show content").check();
  await expect(
    screen.getByRole("heading", "Skills, instructions & workflows"),
  ).toBeVisible();
  await screen.getByRole("link", "Work", { exact: true }).tap();
  await expect(
    screen.getByRole("heading", "Work & agent activity"),
  ).toBeVisible();
  expect(
    await browser.evaluate(() =>
      new URLSearchParams(location.hash.split("?")[1]).get("project"),
    ),
  ).toBe(selectedProject);
  await screen.getByRole("link", "Skills & workflows", { exact: true }).tap();
  await expect(screen.getByRole("heading", "Skills & workflows")).toBeVisible();
  await screen.getByRole("table").getByRole("link").first().tap();
  await expect(screen.getByRole("heading", "Agent runs")).toBeVisible();
  expect(
    await browser.evaluate(() =>
      new URLSearchParams(location.hash.split("?")[1]).get("project"),
    ),
  ).toBe(selectedProject);
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
  await screen.getByRole("link", "Projects", { exact: true }).tap();
  await expect(
    screen.getByRole("heading", "Projects", { exact: true }),
  ).toBeVisible();
  await screen.getByRole("button", "Edit Astack", { exact: true }).tap();
  await expect(
    screen.getByRole("heading", "Edit Astack", { exact: true }),
  ).toBeVisible();
  await screen.getByRole("button", "Save project", { exact: true }).tap();
  await expect(
    screen.getByRole("heading", "Add a project", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByRole("link", "Astack", { exact: true }),
  ).toBeVisible();
  await screen.getByLabel("Color theme").selectOption({ value: "light" });
  expect(
    await browser.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    ),
  ).toBe("light");
  expect(
    await browser.evaluate(() => Object.keys(localStorage).sort()),
  ).toEqual(["astack-observatory-show-content", "astack-observatory-theme"]);
});
