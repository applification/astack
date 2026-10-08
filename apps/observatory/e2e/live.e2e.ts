import { test } from "@e2e-dev/web";
import { expect, secrets } from "e2e";
test("reported generated evaluation connects all captured parent skills and exact trace links", async ({
  app,
  screen,
  browser,
}) => {
  const id =
    "bbb1fd30-527f-4326-b685-fb9c2e021092:evaluation:5b226ef2-442f-4dbe-9ebb-a6d4a5b5ea9a";
  await app.open(
    "/#evaluation/" +
      encodeURIComponent(id) +
      "?project=673cbb36-3688-4d26-8bf9-010b7ec026ed",
  );
  await screen.getByLabel("Private access key").fill(secrets.get("viewer"));
  await screen.getByRole("button", "Open Observatory").tap();
  const workflow = screen.getByRole("region", "Astack workflow", {
    exact: true,
  });
  await expect(
    workflow.getByRole("heading", "Observed skill reads", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    workflow.getByText(
      "Route and phases were not recorded in the linked capture.",
      { exact: true },
    ),
  ).toBeVisible();
  const geometry = () =>
    browser.evaluate(() => ({
      skills: document.querySelectorAll(".map-main-cell .journey-skill-read a")
        .length,
      mainLines: document.querySelectorAll('path[data-connection="main"]')
        .length,
      rootLines: document.querySelectorAll('path[data-connection="root"]')
        .length,
      promptLines: document.querySelectorAll("[data-prompt-connection]").length,
      resultLines: document.querySelectorAll("[data-result-connection]").length,
      pageFits: document.documentElement.scrollWidth <= innerWidth,
    }));
  const expected = {
    skills: 19,
    mainLines: 19,
    rootLines: 1,
    promptLines: 1,
    resultLines: 1,
    pageFits: true,
  };
  await expect.poll(geometry).toEqual(expected);
  await browser.setViewport({ width: 390, height: 844 });
  await expect.poll(geometry).toEqual(expected);
  await workflow
    .getByRole("link", "Astack skill read in main trace", { exact: true })
    .tap();
  await expect(screen.getByRole("heading", "Activity trace")).toBeVisible();
  await expect
    .poll(() =>
      browser.evaluate(() => {
        const id = new URLSearchParams(location.hash.split("?")[1]).get(
          "event",
        );
        const event = document.getElementById(id ?? "");
        return event instanceof HTMLDetailsElement && event.open;
      }),
    )
    .toBe(true);
});

test("deployed astack workflow connects the actual route, phases and evidence without assigning owner grades", async ({
  app,
  screen,
  browser,
}) => {
  const id =
    "bbb1fd30-527f-4326-b685-fb9c2e021092:evaluation:13e793a1-5d1d-4d44-891f-55f871d86d75";
  await app.open(
    "/#evaluation/" +
      encodeURIComponent(id) +
      "?project=a20a2fb3-646f-40fe-9b12-c64f759afaea",
  );
  await screen.getByLabel("Private access key").fill(secrets.get("viewer"));
  await screen.getByRole("button", "Open Observatory").tap();
  await expect(
    screen.getByRole(
      "heading",
      "Observatory — astack route and workflow tracking",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    screen.getByRole("heading", "New feature", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByRole("heading", "Path taken", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByRole("heading", "How the work unfolded"),
  ).not.toBeVisible();
  await expect(screen.getByRole("button", "View PR in Review")).toBeVisible();
  await expect(screen.getByRole("region", "Workflow map")).toBeVisible();
  await screen
    .getByRole("button", "View Testing in Verify", { exact: true })
    .tap();
  const skillEvidence = screen.getByRole("region", "Testing skill evidence", {
    exact: true,
  });
  await expect(skillEvidence).toContainText("Recorded name: testing.");
  // The actual phase declares Testing at both start and finish; inspect the finish.
  await skillEvidence
    .getByRole("link", "Declaration in trace", { exact: true })
    .last()
    .tap();
  await expect(
    screen.getByRole("heading", "Workflow annotation", { exact: true }),
  ).toBeVisible();
  expect(
    await browser.evaluate(
      () =>
        document
          .querySelector(".trace-event[open] .event-content pre")
          ?.textContent?.includes('"testing"') ?? false,
    ),
  ).toBe(true);
  await browser.back();
  await screen
    .getByText("Captured conversation · 2 turns", { exact: true })
    .tap();
  await expect(
    screen.getByRole("heading", "How the work unfolded"),
  ).toBeVisible();
  await screen
    .getByRole("link", "Route selection in trace", { exact: true })
    .tap();
  await expect(
    screen.getByRole("heading", "Workflow annotation", { exact: true }),
  ).toBeVisible();
  expect(
    await browser.evaluate(
      () =>
        document
          .querySelector(".trace-event[open] .event-content pre")
          ?.textContent?.includes('"action": "select"') ?? false,
    ),
  ).toBe(true);
  await browser.back();
  await browser.setViewport({ width: 390, height: 844 });
  await expect(screen.getByRole("region", "Workflow map")).toBeVisible();
  expect(
    await browser.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await screen
    .getByText("Detailed intent and skill review", { exact: true })
    .tap();
  await expect(screen.getByLabel("Include a flow assessment")).toBeVisible();
  await expect(
    screen.getByText("No detailed assessment yet.", { exact: true }),
  ).toBeVisible();
});
test("deployed evaluation links the captured request, retained proof and owner review form", async ({
  app,
  screen,
  browser,
}) => {
  await app.open();
  await screen.getByLabel("Private access key").fill(secrets.get("viewer"));
  await screen.getByRole("button", "Open Observatory").tap();
  await expect(screen.getByRole("heading", "Agent runs")).toBeVisible();
  await screen.getByLabel("Selected project").selectOption({ label: "Astack" });
  await screen.getByRole("link", "Evaluations", { exact: true }).tap();
  await expect(
    screen.getByRole("heading", "Evaluations", { exact: true }),
  ).toBeVisible();
  await screen
    .getByRole("link", "Observatory evaluations — first implementation", {
      exact: true,
    })
    .tap();
  await expect(
    screen.getByRole(
      "heading",
      "Observatory evaluations — first implementation",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    screen.getByText("Checks passed", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("3 captured turns", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByRole("heading", "How the work unfolded"),
  ).toBeVisible();
  await expect(
    screen.getByRole("heading", "Did this deliver what you wanted?"),
  ).toBeVisible();
  await expect(
    screen.getByRole("button", "Yes", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByRole("button", "Partly", { exact: true }),
  ).toBeVisible();
  await expect(screen.getByRole("button", "No", { exact: true })).toBeVisible();
  await expect(
    screen.getByRole("button", "Not sure yet", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByLabel("What worked or should change? (optional)"),
  ).toBeVisible();
  await expect(
    screen.getByLabel("Reason for Intent", { exact: true }),
  ).not.toBeVisible();
  expect(
    await browser.evaluate(() => ({
      steps: document.querySelectorAll(".evaluation-flow > li").length,
      technicalHeadings: [
        ...document.querySelectorAll(".evaluation-flow > li h3"),
      ].some((item) => /turn [a-f0-9]{8}/.test(item.textContent ?? "")),
    })),
  ).toEqual({ steps: 3, technicalHeadings: false });
  await screen
    .getByRole("link", "Original request in trace", { exact: true })
    .tap();
  await expect(screen.getByRole("heading", "Activity trace")).toBeVisible();
  await expect
    .poll(
      () =>
        browser.evaluate(() => {
          const id = new URLSearchParams(location.hash.split("?")[1]).get(
            "event",
          );
          const event = document.getElementById(id ?? "");
          return {
            open: event instanceof HTMLDetailsElement && event.open,
            matchesRequest:
              event
                ?.querySelector(".event-content pre")
                ?.textContent?.includes("astack observatory") ?? false,
          };
        }),
      { timeout: 30_000 },
    )
    .toEqual({ open: true, matchesRequest: true });
  await screen
    .getByRole("link", "Observatory evaluations — first implementation", {
      exact: true,
    })
    .tap();
  await screen
    .getByText("5 checks passed · what was checked?", { exact: true })
    .tap();
  await screen
    .getByText("Verification context & artifact references", { exact: true })
    .tap();
  await browser.setViewport({ width: 390, height: 844 });
  expect(
    await browser.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
test("owner access survives reload and browser restart, and Claude rows show the captured CLI version", async ({
  app,
  screen,
  browser,
}) => {
  await app.open();
  await expect(
    screen.getByRole("heading", "Private Observatory"),
  ).toBeVisible();
  await screen.getByLabel("Private access key").fill(secrets.get("viewer"));
  await screen.getByRole("button", "Open Observatory").tap();
  await expect(screen.getByRole("heading", "Agent runs")).toBeVisible();
  expect(
    await browser.evaluate(() => Object.keys(localStorage).sort()),
  ).toEqual(["astack-observatory-access-key"]);
  await browser.reload();
  await expect(screen.getByRole("heading", "Agent runs")).toBeVisible();
  await expect(screen.getByRole("heading", "Private Observatory")).toHaveCount(
    0,
  );
  await app.restart();
  await expect(screen.getByRole("heading", "Agent runs")).toBeVisible();
  await expect(screen.getByRole("heading", "Private Observatory")).toHaveCount(
    0,
  );
  await screen.getByLabel("Selected project").selectOption({ label: "Astack" });
  await screen.getByRole("button", "Filters", { exact: true }).tap();
  await screen
    .getByLabel("Agent", { exact: true })
    .selectOption({ value: "claude" });
  await expect(
    screen
      .getByRole("region", "Agent runs table")
      .getByText("2.1.291 · Otis", { exact: true })
      .first(),
  ).toBeVisible({ timeout: 30_000 });
});

test("the annotated run has compact metadata, readable naming, real provider assets and no missing-time placeholders", async ({
  app,
  screen,
  browser,
}) => {
  await app.open();
  await screen.getByLabel("Private access key").fill(secrets.get("viewer"));
  await screen.getByRole("button", "Open Observatory").tap();
  await expect(screen.getByRole("heading", "Agent runs")).toBeVisible();
  const runId =
    "bbb1fd30-527f-4326-b685-fb9c2e021092:codex:01a110d1-fea9-7771-a899-60c3c961a438:01a111c1-1455-7c21-b604-04e1ad9d2d78";
  await app.open(
    `/#run/${encodeURIComponent(runId)}?project=a20a2fb3-646f-40fe-9b12-c64f759afaea`,
  );
  await expect(screen.getByRole("heading", "Activity trace")).toBeVisible();
  await expect
    .poll(() =>
      browser.evaluate(
        () => document.querySelector(".run-heading")?.textContent ?? "",
      ),
    )
    .not.toBe("Codex activity in astack");
  const heading = await browser.evaluate(
    () => document.querySelector(".run-heading")?.textContent ?? null,
  );
  expect(heading).not.toContain("Codex turn");
  expect(heading).not.toContain("t3-524669e0");
  await expect(
    screen.getByRole("link", "Repository github.com/applification/astack"),
  ).toHaveText("astack.git");
  await expect
    .poll(() =>
      browser.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLImageElement>(
            ".provider-logo, .repository-logo",
          ),
        ].every((image) => image.complete && image.naturalWidth > 0),
      ),
    )
    .toBe(true);
  await expect(
    screen.getByText("01a110d1…a438", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("01a111c1…2d78", { exact: true }),
  ).toBeVisible();
  await screen.getByText("Full identifiers", { exact: true }).tap();
  await expect(
    screen.getByText("01a110d1-fea9-7771-a899-60c3c961a438", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("Time unavailable", { exact: true }),
  ).toHaveCount(0);
  expect(
    await browser.evaluate(
      () => document.querySelectorAll("time.event-time").length,
    ),
  ).toBeGreaterThan(0);
  await expect(
    screen.getByText(/Some recorded items have no event timestamp/),
  ).toBeVisible();
  if (typeof heading !== "string") throw new Error("Missing run heading");
  await screen.getByRole("link", "Back to runs", { exact: true }).tap();
  await expect(
    screen.getByRole("link", heading, { exact: true }),
  ).toBeVisible();
  await screen.getByRole("link", "Skills & workflows", { exact: true }).tap();
  const rate = screen
    .getByRole("button", /problem rate: \d+ of \d+ runs/)
    .first();
  await rate.hover();
  await expect(screen.getByRole("tooltip")).toBeVisible();
  await expect(screen.getByRole("tooltip")).toContainText(
    "Counts use the selected project scope",
  );
  await rate.press("Escape");
  await expect(screen.getByRole("tooltip")).toHaveCount(0);
});
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
  await expect(trace.getByText(/^Shell command/).first()).toBeVisible();
  await expect(trace.getByText(/^Assistant output/).first()).toBeVisible();
  await expect(trace.getByText("No events captured yet.")).toHaveCount(0);
});
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
  await screen.getByRole("button", "Filters", { exact: true }).tap();
  await expect
    .poll(() =>
      screen.getByLabel("Branch", { exact: true }).getByRole("option").count(),
    )
    .toBeGreaterThan(1);
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
  await screen.getByRole("button", "Filters", { exact: true }).tap();
  for (const page of ["Runs", "Work", "Problems"]) {
    await screen.getByRole("link", page, { exact: true }).tap();
    await expect(
      screen.getByRole("button", "Filters", { exact: true }),
    ).toHaveAttribute("aria-expanded", "false");
    await screen.getByRole("button", "Filters", { exact: true }).tap();
    await expect(screen.getByLabel("Run type", { exact: true })).toBeVisible();
    await expect(
      screen.getByLabel("Scheduled task", { exact: true }),
    ).toBeVisible();
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
  await screen.getByRole("button", "Filters", { exact: true }).tap();
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
    .getByRole("region", "Agent runs table")
    .getByRole("row")
    .nth(1)
    .getByRole("link")
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
  await screen.getByRole("link", "Scheduled tasks", { exact: true }).tap();
  await expect(
    screen.getByRole("heading", "Scheduled tasks", { exact: true }),
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
  ).toEqual([
    "astack-observatory-access-key",
    "astack-observatory-show-content",
    "astack-observatory-theme",
  ]);
  await browser.reload();
  await expect(
    screen.getByRole("heading", "Projects", { exact: true }),
  ).toBeVisible();
  await expect(screen.getByRole("heading", "Private Observatory")).toHaveCount(
    0,
  );
});

test("deployed delivery card loads the actual PR screenshot and connects at desktop and narrow widths", async ({
  app,
  screen,
  browser,
}) => {
  const evaluationId =
    "bbb1fd30-527f-4326-b685-fb9c2e021092:evaluation:5b418a24-5832-4a67-a362-d83c346ff7ed";
  await browser.setViewport({ width: 1440, height: 1000 });
  await app.open(
    "/#evaluation/" +
      encodeURIComponent(evaluationId) +
      "?project=a20a2fb3-646f-40fe-9b12-c64f759afaea",
  );
  await screen.getByLabel("Private access key").fill(secrets.get("viewer"));
  await screen.getByRole("button", "Open Observatory").tap();
  const result = screen.getByRole("region", "Result summary", { exact: true });
  await expect(
    result.getByText("Delivered result", { exact: true }),
  ).toBeVisible();
  expect(
    await result
      .getByRole(
        "link",
        "#26 · Follow agent route journeys from prompt to delivery evidence",
      )
      .getAttribute("href"),
  ).toBe("https://github.com/applification/astack/pull/26");
  await browser.evaluate(() => {
    document.querySelector("[data-result-card]")?.scrollIntoView();
    return true;
  });
  const geometry = () =>
    browser.evaluate(() => {
      const image = document.querySelector(".delivery-image img"),
        path = document.querySelector("[data-result-connection]"),
        card = document.querySelector("[data-result-card]"),
        last = [...document.querySelectorAll("[data-map-main]")].at(-1);
      if (
        !(image instanceof HTMLImageElement) ||
        !(path instanceof SVGPathElement) ||
        !card ||
        !last ||
        !path.ownerSVGElement
      )
        return null;
      const svg = path.ownerSVGElement.getBoundingClientRect(),
        a = last.getBoundingClientRect(),
        b = card.getBoundingClientRect(),
        p = path.getPointAtLength(0),
        q = path.getPointAtLength(path.getTotalLength());
      return {
        imageLoaded: image.complete && image.naturalWidth > 0,
        immutableImage: /\/applification\/astack\/[a-f0-9]{40}\//.test(
          image.src,
        ),
        start:
          Math.abs(svg.left + p.x - a.left - a.width / 2) < 0.5 &&
          Math.abs(svg.top + p.y - a.bottom) < 0.5,
        end:
          Math.abs(svg.left + q.x - b.left - b.width / 2) < 0.5 &&
          Math.abs(svg.top + q.y - b.top) < 0.5,
        pageFits: document.documentElement.scrollWidth <= innerWidth,
      };
    });
  const connected = {
    imageLoaded: true,
    immutableImage: true,
    start: true,
    end: true,
    pageFits: true,
  };
  await expect.poll(geometry, { timeout: 15000 }).toEqual(connected);
  await expect(
    result.getByText("Your review pending", { exact: true }),
  ).toBeVisible();
  await result.getByText("Captured CI details", { exact: true }).tap();
  await expect.poll(geometry).toEqual(connected);
  await browser.setViewport({ width: 390, height: 844 });
  await expect.poll(geometry).toEqual(connected);
});
