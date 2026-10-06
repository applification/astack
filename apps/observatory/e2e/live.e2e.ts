import { test } from "@e2e-dev/web";
import { expect, secrets } from "e2e";
test("the reported T3 run exposes uploaded progress and conversation details", async ({
  app,
  screen,
}) => {
  await app.open();
  await screen.getByLabel("Private access key").fill(secrets.get("viewer"));
  await screen.getByRole("button", "Open Observatory").tap();
  await expect(screen.getByRole("heading", "Agent runs")).toBeVisible();
  const runId =
    "bbb1fd30-527f-4326-b685-fb9c2e021092:codex:01a11053-86c2-7292-a528-bbd248930600:01a11055-b225-75b1-91ae-8d3ba00772ca";
  await app.open(
    `/#run/${encodeURIComponent(runId)}?project=a20a2fb3-646f-40fe-9b12-c64f759afaea`,
  );
  const trace = screen.getByRole("region", "Activity trace");
  await expect(trace.getByRole("status")).toContainText("events uploaded.");
  await expect(
    trace.getByText(/^Shell command/).first(),
  ).toBeVisible();
  await expect(
    trace.getByText(/^Assistant output/).first(),
  ).toBeVisible();
  await expect(trace.getByText("No events captured yet.")).toHaveCount(0);
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
  await screen.getByLabel("Agent").fill("codex");
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
  expect(
    await browser.evaluate(
      () => document.querySelector(".event-preview") !== null,
    ),
  ).toBe(true);
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
