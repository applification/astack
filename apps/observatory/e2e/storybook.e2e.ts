import { test } from "@e2e-dev/web";
import { expect } from "e2e";
test("generation button shows capture requirements, locks pending work and retains a retry after failure", async ({
  app,
  screen,
}) => {
  await app.open(
    "/iframe.html?id=observatory-generate-evaluation--unavailable&viewMode=story",
  );
  await expect(
    screen.getByRole("button", "Generate evaluation", { exact: true }),
  ).toBeDisabled();
  await expect(
    screen.getByText("Readable capture is required to generate an evaluation."),
  ).toBeVisible();
  await app.open(
    "/iframe.html?id=observatory-generate-evaluation--pending&viewMode=story",
  );
  await screen
    .getByRole("button", "Generate evaluation", { exact: true })
    .tap();
  await expect(
    screen.getByRole("button", "Generating evaluation…", { exact: true }),
  ).toBeDisabled();
  await app.open(
    "/iframe.html?id=observatory-generate-evaluation--failure&viewMode=story",
  );
  await screen
    .getByRole("button", "Generate evaluation", { exact: true })
    .tap();
  await expect(screen.getByRole("alert")).toContainText(
    "Could not generate an evaluation.",
  );
  await expect(
    screen.getByRole("button", "Generate evaluation", { exact: true }),
  ).toBeEnabled();
});

test("generation displays an application budget error with a retry", async ({
  app,
  screen,
}) => {
  await app.open(
    "/iframe.html?id=observatory-generate-evaluation--storage-budget&viewMode=story",
  );
  await screen
    .getByRole("button", "Generate evaluation", { exact: true })
    .tap();
  await expect(screen.getByRole("alert")).toHaveText(
    "Evaluation record exceeds its 128 KiB byte budget.",
  );
  await expect(
    screen.getByRole("button", "Generate evaluation", { exact: true }),
  ).toBeEnabled();
});

test("a long captured request renders fully once with a reference criterion", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--long-captured-request&viewMode=story",
  );
  await expect(
    screen.getByRole("heading", "Review a long scheduled request", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await browser.evaluate(
      () =>
        document.querySelector(".evaluation-prompt-text")?.textContent
          ?.length ?? null,
    ),
  ).toBe(5633);
  await screen
    .getByText("0 of 1 checks passed · what was checked?", { exact: true })
    .tap();
  await screen
    .getByText("Fulfil the original request shown above.", { exact: true })
    .first()
    .tap();
  await expect(
    screen.getByText("Fulfil the original request shown above.", {
      exact: true,
    }),
  ).toHaveCount(2);
  await browser.setViewport({ width: 390, height: 844 });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await app.screenshot("long-captured-request-narrow");
});

test("scheduled task rows group history by machine and project with explicit schedule snapshots", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-scheduled-tasks--captured&viewMode=story",
  );
  const table = screen.getByRole("region", "Scheduled tasks table", {
    exact: true,
  });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await app.screenshot("scheduled-tasks-desktop");
  await expect(table.getByRole("row")).toHaveCount(5);
  const desktop = table
    .getByRole("row")
    .filter({ hasText: "daily-health" })
    .filter({ hasText: "Fixture desktop" });
  await expect(desktop.getByRole("cell", "2", { exact: true })).toBeVisible();
  await expect(desktop).toContainText("Daily · 09:00");
  await expect(desktop).toContainText("Next run (last observed)");
  const href = await desktop
    .getByRole("link", "View task history")
    .getAttribute("href");
  const params = new URLSearchParams(href?.split("?")[1]);
  expect(params.get("project")).toBe("00000000-0000-4000-8000-000000000100");
  expect(JSON.parse(params.get("automation") ?? "null")).toEqual([
    "00000000-0000-4000-8000-000000000001",
    "codex",
    ["task", "daily-health"],
  ]);
  await expect(
    table.getByRole("row").filter({ hasText: "Weekly summary" }),
  ).toContainText("Paused");
  await expect(
    table.getByRole("row").filter({ hasText: "Unidentified scheduled task" }),
  ).toContainText("Schedule unavailable");
  await browser.setViewport({ width: 390, height: 844 });
  await expect(table).toBeVisible();
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await table.focus();
  await expect(table).toBeFocused();
  await app.screenshot("scheduled-tasks-narrow");
  await app.open(
    "/iframe.html?id=observatory-scheduled-tasks--separate-projects&viewMode=story",
  );
  await expect(
    screen.getByRole("region", "Scheduled tasks table").getByRole("row"),
  ).toHaveCount(3);
  await app.open(
    "/iframe.html?id=observatory-scheduled-tasks--empty&viewMode=story",
  );
  await expect(
    screen.getByRole("heading", "No captured scheduled tasks"),
  ).toBeVisible();
});

test("scheduled run badges and detail metadata identify automation activity without labelling interactive rows", async ({
  app,
  screen,
}) => {
  await app.open("/iframe.html?id=observatory-runs--scheduled&viewMode=story");
  const table = screen.getByRole("region", "Agent runs table", { exact: true });
  await expect(table.getByRole("link", /^Scheduled task:/)).toHaveCount(5);
  await expect(
    table
      .getByRole("row")
      .filter({ hasText: "Interactive review" })
      .getByRole("link", /^Scheduled task:/),
  ).toHaveCount(0);
  const badge = table.getByRole("link", "Scheduled task: Weekly summary");
  await expect(badge).toHaveAttribute("title", "Weekly summary");
  expect(await badge.getAttribute("href")).toContain("automation=");
  await app.open(
    "/iframe.html?id=observatory-run-metadata--scheduled&viewMode=story",
  );
  await expect(
    screen.getByText("Daily health scan", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("Scheduled task", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("Daily · 09:00", { exact: true }),
  ).toBeVisible();
});

test("scheduled run filters expose the task name and reset through clear filters", async ({
  app,
  screen,
}) => {
  await app.open("/iframe.html?id=observatory-filters--choices&viewMode=story");
  await screen.getByRole("button", "Filters", { exact: true }).tap();
  await screen
    .getByLabel("Run type", { exact: true })
    .selectOption({ label: "Scheduled tasks" });
  await screen
    .getByLabel("Scheduled task", { exact: true })
    .selectOption({ label: "Daily health scan · Fixture desktop" });
  await expect(screen.getByRole("list", "Active filters")).toContainText(
    "Run type: Scheduled tasks",
  );
  await expect(screen.getByRole("list", "Active filters")).toContainText(
    "Scheduled task: Daily health scan · Fixture desktop",
  );
  await screen.getByRole("button", "Clear filters", { exact: true }).tap();
  await expect(screen.getByLabel("Run type", { exact: true })).toHaveValue("");
  await expect(
    screen.getByLabel("Scheduled task", { exact: true }),
  ).toHaveValue("");
});

test("the original prompt leads into the map and stays connected through scope, pan and resize", async ({
  app,
  browser,
  screen,
}) => {
  await browser.setViewport({ width: 1600, height: 1000 });
  await app.open(
    "/iframe.html?id=observatory-evaluations--prompt-origin&viewMode=story",
  );
  const intent = screen.getByRole("region", "Original intent", { exact: true });
  await expect(intent.getByText("User prompt", { exact: true })).toBeVisible();
  await expect(
    intent.getByRole("link", "Original request in trace"),
  ).toBeVisible();
  expect(
    await intent
      .getByRole("link", "Original request in trace")
      .getAttribute("href"),
  ).toContain("event=");
  expect(
    await browser.evaluate(() => ({
      text:
        document.querySelector(".evaluation-prompt-text")?.textContent ?? null,
      quoted:
        document.querySelector(".evaluation-prompt-text")?.tagName ===
        "BLOCKQUOTE",
      editable:
        document.querySelector(
          "[data-prompt-card] input, [data-prompt-card] textarea, [data-prompt-card] [contenteditable=true]",
        ) !== null,
    })),
  ).toEqual({
    text: "Add a route map that shows how a request moves through the agent’s work.\n\nKeep the main journey in the centre. Show delegated work on separate branches, then join the results back into the main line.\n\nKeep the skill evidence easy to open, with enough context to understand each step.",
    quoted: true,
    editable: false,
  });
  const connection = () =>
    browser.evaluate(() => {
      const path = document.querySelector("[data-prompt-connection]");
      const prompt = document.querySelector("[data-prompt-card]");
      const root = document.querySelector("[data-map-root]");
      if (!(path instanceof SVGPathElement) || !prompt || !root) return null;
      const svg = path.ownerSVGElement;
      if (!svg) return null;
      const origin = svg.getBoundingClientRect();
      const card = prompt.getBoundingClientRect();
      const target = root.getBoundingClientRect();
      const start = path.getPointAtLength(0);
      const end = path.getPointAtLength(path.getTotalLength());
      return {
        startsAtPrompt:
          Math.abs(origin.left + start.x - card.left - card.width / 2) < 0.5 &&
          Math.abs(origin.top + start.y - card.bottom) < 0.5,
        endsAtAgent:
          Math.abs(origin.left + end.x - target.left - target.width / 2) <
            0.5 && Math.abs(origin.top + end.y - target.top) < 0.5,
        cardFits: card.left >= 0 && card.right <= innerWidth,
        pageFits: document.documentElement.scrollWidth <= innerWidth,
      };
    });
  const connected = {
    startsAtPrompt: true,
    endsAtAgent: true,
    cardFits: true,
    pageFits: true,
  };
  await expect.poll(connection).toEqual(connected);
  await intent
    .getByText("Agreed scope · 2 clarifications", { exact: true })
    .tap();
  await expect(
    intent.getByText("Keep the map expanded and scrollable.", { exact: true }),
  ).toBeVisible();
  await expect.poll(connection).toEqual(connected);
  await browser.evaluate(() => {
    const viewport = document.querySelector(".workflow-map-scroll");
    if (viewport) viewport.scrollLeft += 50;
    return true;
  });
  await expect.poll(connection).toEqual(connected);
  await browser.setViewport({ width: 390, height: 844 });
  await expect.poll(connection).toEqual(connected);
  await browser.evaluate(() => {
    const viewport = document.querySelector(".workflow-map-scroll");
    if (viewport) viewport.scrollLeft = 0;
    return true;
  });
  await expect
    .poll(() =>
      browser.evaluate(
        () => document.querySelectorAll("[data-prompt-connection]").length,
      ),
    )
    .toBe(0);
  await browser.evaluate(() => {
    const viewport = document.querySelector(".workflow-map-scroll");
    if (viewport)
      viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
    return true;
  });
  await expect.poll(connection).toEqual(connected);
  await app.open(
    "/iframe.html?id=observatory-evaluations--new-feature-flow&viewMode=story",
  );
  await expect(
    screen.getByText("Declared request", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByRole("link", "Original request in trace"),
  ).toHaveCount(0);
  await expect.poll(connection).toEqual(connected);
  await app.open(
    "/iframe.html?id=observatory-evaluations--awaiting-review&viewMode=story",
  );
  await expect(
    screen.getByRole("heading", "Original intent", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      browser.evaluate(
        () => document.querySelectorAll("[data-prompt-connection]").length,
      ),
    )
    .toBe(0);
});
test("one connected map keeps repeated attempts and scoped skill evidence with keyboard return", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--bug-fix-flow&viewMode=story",
  );
  await expect(
    screen.getByRole("heading", "Bug fix", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByRole("button", "Skill sequence", { exact: true }),
  ).toHaveCount(0);
  await expect(
    screen.getByText("Skills in this flow", { exact: true }),
  ).toHaveCount(0);
  expect(
    await browser.evaluate(() =>
      [...document.querySelectorAll(".map-main-cell [data-status]")].map(
        (item) => ({
          phase: item.querySelector("h4")?.textContent ?? null,
          skills: [...item.querySelectorAll(".skill-badges button")].map(
            (button) => button.textContent,
          ),
        }),
      ),
    ),
  ).toEqual([
    { phase: "Reproduce", skills: ["Bug fix", "App control"] },
    { phase: "Repair", skills: ["React", "TypeScript"] },
    { phase: "Verify", skills: ["Verify", "Testing"] },
    { phase: "Repair", skills: ["React"] },
    { phase: "Verify", skills: ["Verify", "Testing"] },
  ]);
  await screen
    .getByRole("button", "View Testing in Verify", { exact: true })
    .first()
    .tap();
  const evidence = screen.getByRole("region", "Testing skill evidence", {
    exact: true,
  });
  await expect(
    evidence.getByRole(
      "link",
      "First verification: fresh read still returns old value",
    ),
  ).toBeVisible();
  await expect(
    evidence.getByRole(
      "link",
      "After repair: reopen and fresh store read retain the edit",
    ),
  ).not.toBeVisible();
  expect(
    await evidence
      .getByRole("link", "Declaration in trace")
      .getAttribute("href"),
  ).toContain("event=");
  await screen.getByRole("button", "Close skill evidence").tap();
  expect(
    await browser.evaluate(
      () => document.activeElement?.getAttribute("aria-label") ?? null,
    ),
  ).toBe("View Testing in Verify");
  await expect
    .poll(() =>
      browser.evaluate(
        () => document.querySelectorAll('path[data-connection="root"]').length,
      ),
    )
    .toBe(1);
  await browser.evaluate(() => {
    document.querySelector('[aria-label="Workflow map"]')?.scrollIntoView();
    return true;
  });
  await app.screenshot("connected-route-retries-light");
  await browser.setViewport({ width: 390, height: 844 });
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  await expect
    .poll(() =>
      browser.evaluate(() => document.documentElement.dataset.theme ?? null),
    )
    .toBe("dark");
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await app.screenshot("connected-route-retries-narrow-dark");
});
test("skill badges preserve recorded names, no-declaration phases and the PR icon without assigning grades", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--skill-capture-gaps&viewMode=story",
  );
  await expect(
    screen.getByRole("button", "View React in Implement"),
  ).toBeVisible();
  await expect(
    screen.getByRole("button", "View TypeScript in Implement"),
  ).toBeVisible();
  await screen.getByRole("button", "View React in Implement").tap();
  await expect(
    screen.getByRole("region", "React skill evidence"),
  ).toContainText("Recorded name: applification:react.");
  await expect(
    screen.getByText("No skills declared for this phase.", { exact: true }),
  ).toBeVisible();
  await expect(screen.getByText("Omitted", { exact: true })).toBeVisible();
  await expect(
    screen.getByText("Started · no finish recorded", { exact: true }),
  ).toBeVisible();
  await screen.getByRole("button", "View PR in Review").tap();
  await expect(screen.getByRole("region", "PR skill evidence")).toContainText(
    "Preparing the PR with retained verification evidence.",
  );
  expect(
    await browser.evaluate(() => {
      const image = document.querySelector(
        'button[aria-label="View PR in Review"] img',
      );
      return (
        image instanceof HTMLImageElement &&
        image.complete &&
        image.naturalWidth > 0 &&
        image.getAttribute("src") === "/providers/github.svg"
      );
    }),
  ).toBe(true);
  await screen
    .getByRole(
      "button",
      "View owner:repository-specific-acceptance-check in Implement",
    )
    .tap();
  await expect(
    screen.getByRole(
      "region",
      "owner:repository-specific-acceptance-check skill evidence",
    ),
  ).toContainText("Recorded name: owner:repository-specific-acceptance-check.");
  await browser.setViewport({ width: 360, height: 800 });
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  await expect
    .poll(() =>
      browser.evaluate(() => ({
        theme: document.documentElement.dataset.theme ?? null,
        badgeColor: getComputedStyle(
          document.querySelector('button[aria-label="View PR in Review"]') ??
            document.body,
        ).color,
      })),
    )
    .toEqual({ theme: "dark", badgeColor: "rgb(248, 250, 252)" });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    screen.getByText("Your review pending", { exact: true }),
  ).toBeVisible();
  await screen
    .getByRole("region", "PR skill evidence", { exact: true })
    .getByRole("button", "Close skill evidence")
    .tap();
  await screen
    .getByRole(
      "region",
      "owner:repository-specific-acceptance-check skill evidence",
      { exact: true },
    )
    .getByRole("button", "Close skill evidence")
    .tap();
  await browser.evaluate(() => {
    const section = document.querySelector('[aria-label="Astack workflow"]');
    if (section)
      window.scrollTo(
        0,
        section.getBoundingClientRect().top +
          window.scrollY -
          (document.querySelector("header")?.getBoundingClientRect().height ??
            80) -
          16,
      );
    return null;
  });
  await app.screenshot("connected-map-custom-skills-narrow-dark");
});
test("connected map retains route changes and missing supporting evidence", async ({
  app,
  screen,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--changed-flow&viewMode=story",
  );
  await expect(
    screen.getByRole("heading", "Changed route → Bug fix"),
  ).toBeVisible();
  await app.open(
    "/iframe.html?id=observatory-evaluations--missing-flow-evidence&viewMode=story",
  );
  await screen
    .getByRole("button", "View Testing in Verify", { exact: true })
    .first()
    .tap();
  await expect(
    screen.getByRole("region", "Testing skill evidence"),
  ).toContainText("Referenced trace event has not been captured.");
});
test("astack bug-fix flow preserves verification retries and links declared skills to captured evidence", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--bug-fix-flow&viewMode=story",
  );
  await expect(
    screen.getByRole("heading", "Bug fix", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText(
      "Restore existing save behaviour and reproduce the reported symptom.",
      { visible: true },
    ),
  ).toBeVisible();
  expect(
    await browser.evaluate(() =>
      [...document.querySelectorAll(".map-main-cell h4")].map(
        (item) => item.textContent,
      ),
    ),
  ).toEqual(["Reproduce", "Repair", "Verify", "Repair", "Verify"]);
  await expect(
    screen.getByText("Failed · agent reported", { exact: true }),
  ).toBeVisible();
  await screen
    .getByRole("button", "View Bug fix in Reproduce", { exact: true })
    .tap();
  await expect(
    screen.getByRole("link", "Before fix: reopening loses the saved edit"),
  ).toBeVisible();
  const link = await screen
    .getByRole("link", "Before fix: reopening loses the saved edit")
    .getAttribute("href");
  expect(link).toContain("event=");
  await app.screenshot("astack-bug-fix-flow-light");
  await browser.setViewport({ width: 390, height: 844 });
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await app.screenshot("astack-bug-fix-flow-narrow-dark");
});
test("astack new-feature flow explains omissions and leaves unfinished phases ungraded", async ({
  app,
  screen,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--new-feature-flow&viewMode=story",
  );
  await expect(
    screen.getByRole("heading", "New feature", { exact: true }),
  ).toBeVisible();
  await expect(screen.getByText("Omitted", { exact: true })).toBeVisible();
  await expect(
    screen.getByText(
      "Reuse the agreed editor layout; no new interaction design is required.",
      { visible: true },
    ),
  ).toBeVisible();
  await expect(
    screen.getByText("Started · no finish recorded", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("Your review pending", { exact: true }),
  ).toBeVisible();
  await app.screenshot("astack-new-feature-flow");
});
test("astack route changes, missing selection and unavailable evidence stay explicit", async ({
  app,
  screen,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--changed-flow&viewMode=story",
  );
  await expect(
    screen.getByRole("heading", "Investigation", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByRole("heading", "Changed route → Bug fix"),
  ).toBeVisible();
  await expect(
    screen
      .getByText(
        "The reproduction confirmed a persistence defect; continue through the repair route.",
      )
      .first(),
  ).toBeVisible();
  await app.screenshot("astack-route-change");
  await app.open(
    "/iframe.html?id=observatory-evaluations--missing-flow-selection&viewMode=story",
  );
  await expect(
    screen.getByRole("heading", "Route not recorded", { exact: true }),
  ).toBeVisible();
  await expect(screen.getByRole("status")).toContainText("display limit");
  await app.open(
    "/iframe.html?id=observatory-evaluations--missing-flow-evidence&viewMode=story",
  );
  await screen
    .getByRole("button", "View Testing in Verify", { exact: true })
    .first()
    .tap();
  await expect(
    screen.getByText("Referenced trace event has not been captured.", {
      exact: true,
      visible: true,
    }),
  ).toBeVisible();
  await app.open(
    "/iframe.html?id=observatory-evaluations--awaiting-review&viewMode=story",
  );
  await expect(
    screen.getByText(
      "Route and phases were not recorded in the linked capture.",
      {
        exact: false,
      },
    ),
  ).toBeVisible();
});
test("owner flow judgments select captured evidence and remain separate from outcome feedback", async ({
  app,
  screen,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--flow-review&viewMode=story",
  );
  await screen
    .getByText("Detailed intent and skill review", { exact: true })
    .tap();
  await screen.getByLabel("Include a flow assessment").check();
  for (const name of [
    "Intent",
    "bug-fix",
    "verify",
    "Outcome",
    "Route choice",
    "Flow execution",
  ])
    await screen
      .getByLabel("Reason for " + name, { exact: true })
      .fill(
        "Reviewed the captured declarations and supporting before/after evidence.",
      );
  await screen
    .getByLabel("Route choice verdict", { exact: true })
    .selectOption({ value: "pass" });
  await screen.getByRole("button", "Save assessment", { exact: true }).tap();
  await expect(screen.getByRole("status")).toContainText("Assessment saved");
  await expect(
    screen.getByText("Route choice: Pass", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("Flow execution: Inconclusive", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("Your review pending", { exact: true }),
  ).toBeVisible();
});
for (const [story, checkStatus, outcome] of [
  ["awaiting-review", "Checks passed", null],
  ["passing", "Checks passed", "Pass"],
  ["failed", "Checks found a problem", "Fail"],
  ["inconclusive", "Checks incomplete", "Inconclusive"],
  ["missing-proof", "Checks incomplete", null],
] as const) {
  test(
    "evaluation " +
      story +
      " explains checks and keeps technical grading separate",
    async ({ app, screen, browser }) => {
      await app.open(
        "/iframe.html?id=observatory-evaluations--" + story + "&viewMode=story",
      );
      await expect(
        screen.getByRole("heading", "Preserve edits after reopening"),
      ).toBeVisible();
      await expect(
        screen.getByText(checkStatus, { exact: true }),
      ).toBeVisible();
      await expect(
        screen.getByText("Your review pending", { exact: true }),
      ).toBeVisible();
      await expect(screen.getByText("2 captured turns")).toBeVisible();
      await expect(
        screen.getByRole("heading", "How the work unfolded"),
      ).toBeVisible();
      expect(
        await browser.evaluate(() =>
          [...document.querySelectorAll(".evaluation-flow > li h3")].map(
            (item) => item.textContent,
          ),
        ),
      ).toEqual(["Reproduce a lost saved edit", "Repair saved edits"]);
      if (story === "awaiting-review") {
        await app.screenshot("evaluation-timeline-default-light");
        await browser.setViewport({ width: 1280, height: 900 });
        await browser.evaluate(() => {
          const section = document.querySelector(
            '[aria-label="Work timeline"]',
          );
          if (section)
            window.scrollTo(
              0,
              section.getBoundingClientRect().top +
                window.scrollY -
                (document.querySelector("header")?.getBoundingClientRect()
                  .height ?? 80) -
                16,
            );
          return null;
        });
        await app.screenshot("evaluation-work-timeline-light");
      }
      await expect(
        screen.getByRole("heading", "Skill application & output criteria"),
      ).not.toBeVisible();
      if (outcome) {
        await screen
          .getByText("Detailed intent and skill review", { exact: true })
          .tap();
        await expect(
          screen.getByText("Outcome: " + outcome, { exact: true }),
        ).toBeVisible();
      }
      if (story === "failed") {
        await app.screenshot("evaluation-timeline-failed-light");
        await browser.setViewport({ width: 390, height: 844 });
        await screen.getByLabel("Color theme").selectOption({ value: "dark" });
        await screen
          .getByText("0 of 1 checks passed · what was checked?", {
            exact: true,
          })
          .tap();
        await screen
          .getByText(
            "The saved edit survives reopening and a fresh store read.",
            { exact: true },
          )
          .first()
          .tap();
        await expect(
          screen
            .getByText("Reopened document contains the old value.", {
              exact: true,
            })
            .first(),
        ).toBeVisible();
        expect(
          await browser.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await app.screenshot("evaluation-timeline-failed-narrow-dark");
      }
    },
  );
}
test("outcome review needs only a choice, retains failed-write answers and shows saved history", async ({
  app,
  screen,
}) => {
  for (const story of ["review-failure", "review"]) {
    await app.open(
      "/iframe.html?id=observatory-evaluations--" + story + "&viewMode=story",
    );
    await screen.getByRole("button", "Save review", { exact: true }).tap();
    await expect(screen.getByRole("alert")).toContainText("Choose how well");
    await screen.getByRole("button", "Partly", { exact: true }).tap();
    await screen
      .getByLabel("What worked or should change? (optional)")
      .fill("The result is useful, but the review flow needs refinement.");
    await screen.getByRole("button", "Save review", { exact: true }).tap();
    if (story === "review-failure") {
      await expect(screen.getByRole("alert")).toContainText(
        "Your review could not be saved",
      );
      await expect(
        screen.getByLabel("What worked or should change? (optional)"),
      ).toHaveValue(
        "The result is useful, but the review flow needs refinement.",
      );
      await expect(
        screen.getByRole("button", "Partly", { exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        screen.getByRole("button", "Save review", { exact: true }),
      ).toBeEnabled();
    } else {
      await expect(
        screen.getByText("Your review: Partly", { exact: true }).first(),
      ).toBeVisible();
      await expect(screen.getByRole("status")).toContainText(
        "Your review is saved.",
      );
      await screen.getByText("Review history · 1", { exact: true }).tap();
      await expect(
        screen
          .getByText(
            "The result is useful, but the review flow needs refinement.",
            { exact: true },
          )
          .last(),
      ).toBeVisible();
      await expect(
        screen.getByRole("button", "Save review", { exact: true }),
      ).toBeEnabled();
      await app.screenshot("evaluation-outcome-review");
    }
  }
});
test("detailed owner assessment remains available with explicit evidence", async ({
  app,
  screen,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--review&viewMode=story",
  );
  await screen
    .getByText("Detailed intent and skill review", { exact: true })
    .tap();
  for (const name of ["Intent", "bug-fix", "verify", "Outcome"]) {
    await screen.getByLabel(name + " verdict").selectOption({ value: "pass" });
    await screen
      .getByLabel("Reason for " + name)
      .fill("Reviewed the acceptance evidence and relevant captured work.");
  }
  await screen.getByRole("button", "Save assessment").tap();
  await expect(
    screen.getByText("Outcome: Pass", { exact: true }),
  ).toBeVisible();
  await expect(screen.getByText("Assessment saved.")).toBeVisible();
  await expect(
    screen.getByText("Your review pending", { exact: true }),
  ).toBeVisible();
});
test("missing captured content has an honest fallback and responsive review choices", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--missing-content&viewMode=story",
  );
  await expect(
    screen
      .getByText("No request excerpt available for this turn.", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await browser.setViewport({ width: 390, height: 844 });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await app.open(
    "/iframe.html?id=observatory-evaluations--review&viewMode=story",
  );
  await screen.getByRole("button", "Yes", { exact: true }).tap();
  await screen.getByRole("button", "Save review", { exact: true }).tap();
  await expect(
    screen.getByText("Your review: Yes", { exact: true }).first(),
  ).toBeVisible();
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    screen.getByRole("button", "Save review", { exact: true }),
  ).toBeEnabled();
  await app.screenshot("evaluation-timeline-review-narrow");
});
test("empty evaluation scope is explicit", async ({ app, screen }) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--empty&viewMode=story",
  );
  await expect(
    screen.getByText("No evaluations in this project scope yet."),
  ).toBeVisible();
});
const authStory =
  "/iframe.html?id=observatory-authentication--remembered-access&viewMode=story";
test("successful owner login remembers the trimmed key and obtains a fresh session after reload", async ({
  app,
  screen,
  browser,
}) => {
  const requests: { method: string; authorization: string | undefined }[] = [];
  await browser.route("**/auth/session", async (route) => {
    requests.push({
      method: route.request.method,
      authorization: route.request.headers.authorization,
    });
    await route.fulfill(
      route.request.headers.authorization === "Bearer fixture-owner-key"
        ? { json: { token: "fixture-short-lived-jwt" } }
        : { status: 401, json: {} },
    );
  });
  await app.open(authStory);
  await expect(
    screen.getByRole("heading", "Private Observatory"),
  ).toBeVisible();
  await app.screenshot("remembered-access-login");
  await screen.getByLabel("Private access key").fill("  fixture-owner-key  ");
  await screen.getByRole("button", "Open Observatory").tap();
  await expect(
    screen.getByRole("heading", "Authenticated fixture"),
  ).toBeVisible();
  expect(
    await browser.evaluate(() =>
      localStorage.getItem("astack-observatory-access-key"),
    ),
  ).toBe("fixture-owner-key");
  expect(
    await browser.evaluate(() => JSON.stringify(localStorage)),
  ).not.toContain("fixture-short-lived-jwt");
  const beforeReload = requests.length;
  await browser.reload();
  await expect(
    screen.getByRole("heading", "Authenticated fixture"),
  ).toBeVisible();
  expect(
    requests
      .slice(beforeReload)
      .every(
        (request) =>
          request.method === "POST" &&
          request.authorization === "Bearer fixture-owner-key",
      ),
  ).toBe(true);
  expect(requests.length).toBeGreaterThan(beforeReload);
});

test("offline sessions preserve the saved key, while rejected keys are removed and can be replaced", async ({
  app,
  screen,
  browser,
}) => {
  let mode: "accepted" | "offline" | "denied" = "accepted";
  await browser.route("**/auth/session", async (route) => {
    const authorized =
      route.request.headers.authorization === "Bearer fixture-owner-key";
    await route.fulfill(
      mode === "offline"
        ? { status: 503, json: {} }
        : mode === "accepted" && authorized
          ? { json: { token: "fixture-short-lived-jwt" } }
          : { status: 401, json: {} },
    );
  });
  await app.open(authStory);
  await screen.getByLabel("Private access key").fill("fixture-owner-key");
  await screen.getByRole("button", "Open Observatory").tap();
  await expect(
    screen.getByRole("heading", "Authenticated fixture"),
  ).toBeVisible();
  mode = "offline";
  await browser.reload();
  await expect(
    screen.getByText(
      "The private service is unavailable. Check Tailscale and retry.",
    ),
  ).toBeVisible();
  expect(
    await browser.evaluate(() =>
      localStorage.getItem("astack-observatory-access-key"),
    ),
  ).toBe("fixture-owner-key");
  mode = "accepted";
  await screen.getByRole("button", "Retry connection").tap();
  await expect(
    screen.getByRole("heading", "Authenticated fixture"),
  ).toBeVisible();
  mode = "denied";
  await screen.getByRole("button", "Refresh session").tap();
  await expect(
    screen.getByRole("heading", "Private Observatory"),
  ).toBeVisible();
  expect(
    await browser.evaluate(() =>
      localStorage.getItem("astack-observatory-access-key"),
    ),
  ).toBeNull();
  await screen.getByLabel("Private access key").fill("invalid-fixture-key");
  await screen.getByRole("button", "Open Observatory").tap();
  await expect(
    screen.getByRole("heading", "Private Observatory"),
  ).toBeVisible();
  // The runner forbids reading password values; an enabled retry proves the draft survives.
  await expect(screen.getByRole("button", "Open Observatory")).toBeEnabled();
  expect(
    await browser.evaluate(() =>
      localStorage.getItem("astack-observatory-access-key"),
    ),
  ).toBeNull();
  mode = "accepted";
  await screen.getByLabel("Private access key").fill("fixture-owner-key");
  await screen.getByRole("button", "Open Observatory").tap();
  await expect(
    screen.getByRole("heading", "Authenticated fixture"),
  ).toBeVisible();
  expect(
    await browser.evaluate(() =>
      localStorage.getItem("astack-observatory-access-key"),
    ),
  ).toBe("fixture-owner-key");
});

test("unavailable browser storage still permits in-memory login", async ({
  app,
  screen,
  browser,
}) => {
  await browser.route("**/auth/session", async (route) => {
    await route.fulfill(
      route.request.headers.authorization === "Bearer fixture-owner-key"
        ? { json: { token: "fixture-short-lived-jwt" } }
        : { status: 401, json: {} },
    );
  });
  await app.open(authStory);
  await expect(
    screen.getByRole("heading", "Private Observatory"),
  ).toBeVisible();
  await browser.evaluate(() => {
    for (const method of ["getItem", "setItem", "removeItem"])
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value: () => {
          throw new Error("fixture-storage-denied");
        },
      });
    return true;
  });
  await screen.getByLabel("Private access key").fill("fixture-owner-key");
  await screen.getByRole("button", "Open Observatory").tap();
  await expect(
    screen.getByRole("heading", "Authenticated fixture"),
  ).toBeVisible();
});

test("run rows display Claude CLI versions independently of model names, retaining unknown and Codex versions", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-runs--claude-cli-versions&viewMode=story",
  );
  const table = screen.getByRole("region", "Agent runs table");
  await expect(
    table.getByText("2.1.291 · Otis", { exact: true }),
  ).toBeVisible();
  await expect(
    table.getByText("0.160.1 · Otis", { exact: true }),
  ).toBeVisible();
  await expect(
    table.getByText("Version unknown · Dave’s MacBook", { exact: true }),
  ).toBeVisible();
  await expect(
    table.getByText("claude-sonnet-5-5", { exact: true }),
  ).toHaveCount(0);
  await browser.setViewport({ width: 1280, height: 1120 });
  await app.screenshot("claude-cli-versions");
});

test("compact metadata preserves full identifiers and reports clipboard success and failure", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-run-metadata--compact&viewMode=story",
  );
  await expect(
    screen.getByRole(
      "heading",
      "Review authentication session handling and expired-session recovery",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    screen.getByRole("link", "Repository github.com/fixture/astack"),
  ).toHaveAttribute("href", "https://github.com/fixture/astack");
  await expect(
    screen.getByText("0f3a8c21…83bb", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("0f3a8c21-6e4b-4a90-b913-07a135f683bb", { exact: true }),
  ).not.toBeVisible();
  await app.screenshot("run-metadata-light-desktop");
  await screen.getByText("Full identifiers", { exact: true }).tap();
  await expect(
    screen.getByText("0f3a8c21-6e4b-4a90-b913-07a135f683bb", { exact: true }),
  ).toBeVisible();
  await browser.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) =>
          sessionStorage.setItem("fixture-copy", text),
      },
    });
    return true;
  });
  await screen.getByRole("button", "Copy session ID", { exact: true }).tap();
  expect(
    await browser.evaluate(() => sessionStorage.getItem("fixture-copy")),
  ).toBe("0f3a8c21-6e4b-4a90-b913-07a135f683bb");
  await expect(screen.getByRole("status")).toHaveText("Copied");
  await browser.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("fixture-denied");
        },
      },
    });
    return true;
  });
  await screen.getByRole("button", "Copy attempt ID", { exact: true }).tap();
  await expect(
    screen.getByText("Copy unavailable; select the full value.", {
      exact: true,
    }),
  ).toBeVisible();
  await browser.setViewport({ width: 390, height: 844 });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await browser.evaluate(() => {
      const heading = document.querySelector(".run-heading");
      return heading ? parseFloat(getComputedStyle(heading).fontSize) : 0;
    }),
  ).toBe(32);
  await app.screenshot("run-metadata-light-narrow");
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  await app.screenshot("run-metadata-dark-narrow");
  await app.open(
    "/iframe.html?id=observatory-run-metadata--native-fallback&viewMode=story",
  );
  await expect(
    screen.getByRole("heading", "Codex activity in astack", { exact: true }),
  ).toBeVisible();
});

test("provider marks load and problem-rate help works by hover, focus and tap beyond table clipping", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-run-metadata--providers-and-rates&viewMode=story",
  );
  await expect
    .poll(() =>
      browser.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLImageElement>(".provider-logo"),
        ].every((image) => image.complete && image.naturalWidth > 0),
      ),
    )
    .toBe(true);
  await expect(screen.getByText("Claude", { exact: true })).toBeVisible();
  await expect(
    screen.getByText("other-provider", { exact: true }),
  ).toBeVisible();
  const rate = screen.getByRole("button", "19% problem rate: 3 of 16 runs", {
    exact: true,
  });
  await rate.hover();
  await expect(screen.getByRole("tooltip")).toContainText(
    "3 of 16 runs had a problem",
  );
  await expect(screen.getByRole("tooltip")).toContainText(
    "informational findings are excluded",
  );
  await rate.press("Escape");
  await expect(screen.getByRole("tooltip")).toHaveCount(0);
  await rate.press("Tab");
  await browser.keyboard.press("Shift+Tab");
  await expect(screen.getByRole("tooltip")).toBeAttached();
  await rate.press("Enter");
  await browser.mouse.move(0, 0);
  await expect(screen.getByRole("tooltip")).toBeVisible();
  await rate.press("Escape");
  await browser.setViewport({ width: 390, height: 844 });
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  await rate.tap();
  await expect(screen.getByRole("tooltip")).toContainText(
    "same version/hash and provenance group",
  );
  await browser.mouse.move(0, 0);
  await expect
    .poll(() =>
      browser.evaluate(() => {
        const card = document.querySelector(".help-card");
        if (!card) return false;
        const rect = card.getBoundingClientRect();
        return (
          rect.width > 250 &&
          rect.height > 100 &&
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          rect.top >= 0 &&
          rect.bottom <= innerHeight &&
          !card.closest(".table-scroll")
        );
      }),
    )
    .toBe(true);
  await app.screenshot("problem-rate-help-dark-narrow");
  await screen.getByRole("link", "Runs", { exact: true }).tap();
  await expect(screen.getByRole("tooltip")).toHaveCount(0);
});
test("reactive naming subscriptions render pending fallbacks and survive fresh run objects", async ({
  app,
  screen,
}) => {
  await app.open(
    "/iframe.html?id=observatory-runs--reactive-naming-fallback&viewMode=story",
  );
  await expect(
    screen.getByRole("link", "Validate ingestion", { exact: true }),
  ).toBeVisible();
  await screen.getByRole("button", "Refresh activity").tap();
  await expect(screen.getByText("Refreshed 1", { exact: true })).toBeVisible();
  await expect(
    screen.getByRole("link", "Validate ingestion", { exact: true }),
  ).toBeVisible();
});
test("Work and activities use readable cached names with source fallbacks and explicit label precedence", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-runs--named-work-and-activities&viewMode=story",
  );
  await expect(
    screen.getByRole("link", "Add readable Work headings", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByRole("link", "Name activities using the Codex subscription", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    screen.getByRole("link", "Codex activity in astack", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByRole("link", "Name Work and agent activity", { exact: false }),
  ).toHaveCount(3);
  await browser.setViewport({ width: 1280, height: 1360 });
  await app.screenshot("work-activity-names-light");
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  await browser.setViewport({ width: 390, height: 844 });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await app.screenshot("work-activity-names-dark-narrow");
  await app.open(
    "/iframe.html?id=observatory-runs--explicit-work-label&viewMode=story",
  );
  await expect(
    screen.getByRole("link", "Owner’s chosen heading", { exact: false }),
  ).toBeVisible();
  await expect(
    screen.getByText("Generated heading", { exact: true }),
  ).toHaveCount(0);
});
test("upload progress distinguishes waiting, partial, paginated and complete traces", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-trace--waiting-for-upload&viewMode=story",
  );
  await expect(screen.getByRole("status")).toHaveText(
    "0 of 169 events uploaded. Syncing the remaining events…",
  );
  await expect(screen.getByText("No events captured yet.")).toHaveCount(0);
  await screen.getByLabel("Color theme").selectOption({ value: "light" });
  await app.screenshot("trace-waiting-upload-light");
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  await browser.setViewport({ width: 390, height: 844 });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await app.screenshot("trace-waiting-upload-dark-narrow");
  await app.open(
    "/iframe.html?id=observatory-trace--partly-uploaded&viewMode=story",
  );
  await expect(screen.getByRole("status")).toHaveText(
    "5 of 169 events uploaded. Syncing the remaining events…",
  );
  await screen.getByLabel("Failures and interventions only").check();
  await expect(screen.getByRole("status")).toContainText(
    "5 of 169 events uploaded.",
  );
  await app.open(
    "/iframe.html?id=observatory-trace--more-uploaded-events&viewMode=story",
  );
  await expect(screen.getByRole("status")).toHaveText(
    "At least 5 of 169 events uploaded. 5 loaded here. More events are available below.",
  );
  await app.open(
    "/iframe.html?id=observatory-trace--upload-complete&viewMode=story",
  );
  await expect(screen.getByRole("status")).toHaveText(
    "5 of 5 events uploaded. Trace up to date.",
  );
  await app.open(
    "/iframe.html?id=observatory-trace--checking-upload&viewMode=story",
  );
  await expect(screen.getByRole("status")).toHaveText(
    "Checking uploaded events…",
  );
  await app.open(
    "/iframe.html?id=observatory-trace--summary-updating&viewMode=story",
  );
  await expect(screen.getByRole("status")).toHaveText(
    "5 events uploaded. Capture summary updating.",
  );
  await app.open(
    "/iframe.html?id=observatory-trace--loading-more-uploads&viewMode=story",
  );
  await expect(screen.getByRole("status")).toHaveText(
    "At least 5 of 169 events uploaded. 5 loaded here. Loading more…",
  );
});
test("categorical menus keep choices available after selection and clear categories and dates", async ({
  app,
  screen,
  browser,
}) => {
  await app.open("/iframe.html?id=observatory-filters--choices&viewMode=story");
  await screen.getByLabel("Color theme").selectOption({ value: "light" });
  await expect(
    screen.getByRole("button", "Filters", { exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await screen.getByRole("button", "Filters", { exact: true }).tap();
  expect(
    await browser.evaluate(
      () => document.querySelectorAll(".filters select").length,
    ),
  ).toBe(12);
  expect(
    await browser.evaluate(
      () => document.querySelectorAll('.filters input[type="text"]').length,
    ),
  ).toBe(0);
  await screen
    .getByLabel("Status", { exact: true })
    .selectOption({ value: "failed" });
  await expect(screen.getByLabel("Status", { exact: true })).toHaveValue(
    "failed",
  );
  await screen
    .getByLabel("Branch", { exact: true })
    .selectOption({ value: "older-history-branch" });
  await screen
    .getByLabel("Machine", { exact: true })
    .selectOption({ label: "Dave’s MacBook · fixture-macbook" });
  await expect(screen.getByLabel("Machine", { exact: true })).toHaveValue(
    "fixture-macbook",
  );
  await screen
    .getByLabel("Branch", { exact: true })
    .selectOption({ value: "codex/observatory" });
  await screen
    .getByLabel("Status", { exact: true })
    .selectOption({ value: "" });
  await screen.getByLabel("From date").fill("2026-10-01");
  await screen.getByLabel("Through date").fill("2026-10-06");
  await app.screenshot("filter-menus-light");
  await screen.getByRole("button", "Clear filters", { exact: true }).tap();
  await expect(screen.getByLabel("Machine", { exact: true })).toHaveValue("");
  await expect(screen.getByLabel("Branch", { exact: true })).toHaveValue("");
  await expect(screen.getByLabel("From date")).toHaveValue("");
  await expect(screen.getByLabel("Through date")).toHaveValue("");
  await screen.getByLabel("From date").fill("2026-10-01");
  await expect(
    screen.getByRole("button", "Clear filters", { exact: true }),
  ).toBeVisible();
  await screen.getByRole("button", "Clear filters", { exact: true }).tap();
  await expect(screen.getByLabel("From date")).toHaveValue("");
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  await browser.setViewport({ width: 390, height: 844 });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await app.screenshot("filter-menus-narrow-dark");
});
test("filter loading, empty and unavailable URL selections remain usable", async ({
  app,
  screen,
}) => {
  await app.open("/iframe.html?id=observatory-filters--loading&viewMode=story");
  await screen.getByRole("button", "Filters", { exact: true }).tap();
  await expect(screen.getByLabel("Branch", { exact: true })).toBeDisabled();
  await expect(screen.getByLabel("Status", { exact: true })).toBeEnabled();
  await expect(
    screen.getByText("Loading filter choices…", { exact: true }),
  ).toBeVisible();
  await app.open("/iframe.html?id=observatory-filters--empty&viewMode=story");
  await screen.getByRole("button", "Filters", { exact: true }).tap();
  await expect(screen.getByLabel("Branch", { exact: true })).toBeEnabled();
  await expect(
    screen.getByLabel("Branch", { exact: true }).getByRole("option"),
  ).toHaveCount(1);
  await app.open(
    "/iframe.html?id=observatory-filters--unavailable-selection&viewMode=story",
  );
  await expect(screen.getByRole("list", "Active filters")).toContainText(
    "removed-branch",
  );
  await screen.getByRole("button", "Filters", { exact: true }).tap();
  await expect(screen.getByLabel("Branch", { exact: true })).toHaveValue(
    "removed-branch",
  );
  await expect(
    screen
      .getByLabel("Branch", { exact: true })
      .getByRole("option", "removed-branch · unavailable", { exact: true }),
  ).toBeAttached();
  await screen
    .getByLabel("Branch", { exact: true })
    .selectOption({ value: "" });
  await expect(screen.getByLabel("Branch", { exact: true })).toHaveValue("");
});
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
  await expect(screen.getByText("Time unavailable")).toHaveCount(0);
  expect(
    await browser.evaluate(
      () => document.querySelectorAll(".event-time").length,
    ),
  ).toBe(2);
  await expect(
    screen.getByText("Some recorded items have no event timestamp", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(screen.getByText("Hook", { exact: true })).toBeVisible();
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
  await expect(
    screen.getByRole("link", "Work · Fixture work reference"),
  ).toHaveCount(3);
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

test("project management adds/edits/pauses a project and keeps the selector readable on narrow screens", async ({
  app,
  screen,
  browser,
}) => {
  await app.open("/iframe.html?id=observatory-projects--mixed&viewMode=story");
  await expect(screen.getByRole("heading", "Projects")).toBeVisible();
  await screen.getByLabel("Project name").fill("Checkout");
  await screen
    .getByLabel("Repository URLs")
    .fill("git@github.com:fixture/checkout.git");
  await screen.getByRole("button", "Save project", { exact: true }).tap();
  await expect(
    screen.getByRole("link", "Checkout", { exact: true }),
  ).toBeVisible();
  await screen.getByRole("button", "Edit Checkout", { exact: true }).tap();
  await screen.getByLabel("Project name").fill("Checkout app");
  await screen.getByRole("button", "Save project", { exact: true }).tap();
  await expect(
    screen.getByRole("link", "Checkout app", { exact: true }),
  ).toBeVisible();
  await screen.getByRole("button", "Pause Astack", { exact: true }).tap();
  await expect(
    screen.getByRole("button", "Resume Astack", { exact: true }),
  ).toBeVisible();
  await screen
    .getByLabel("Selected project")
    .selectOption({ value: "00000000-0000-4000-8000-000000000100" });
  await app.screenshot("projects-managed");
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  await browser.setViewport({ width: 390, height: 844 });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await app.screenshot("projects-narrow-dark");
});
test("project empty/loading/failed-save states keep unsaved input and do not claim persistence", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-projects--loading&viewMode=story",
  );
  await expect(
    screen.getByText("Loading projects…", { exact: true }),
  ).toBeVisible();
  await expect(screen.getByLabel("Selected project")).toBeDisabled();
  await expect(
    screen.getByRole("button", "Save project", { exact: true }),
  ).toHaveCount(0);
  await app.open("/iframe.html?id=observatory-projects--empty&viewMode=story");
  await expect(
    screen.getByText(
      "No projects enrolled. Add your first project to start capture.",
      { exact: true },
    ),
  ).toBeVisible();
  await app.open(
    "/iframe.html?id=observatory-projects--save-error&viewMode=story",
  );
  await screen.getByLabel("Project name").fill("Unsaved project");
  await screen
    .getByLabel("Repository URLs")
    .fill("https://github.com/fixture/unsaved");
  await screen.getByRole("button", "Save project", { exact: true }).tap();
  await expect(screen.getByRole("alert")).toBeVisible();
  expect(
    await browser.evaluate(
      () =>
        document.querySelector<HTMLInputElement>('[aria-label="Project name"]')
          ?.value ?? null,
    ),
  ).toBe("Unsaved project");
  await expect(
    screen.getByRole("link", "Unsaved project", { exact: true }),
  ).toHaveCount(0);
});

test("child lanes stay expanded, connect to declared joins and retain separate retry evidence", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--parallel-journeys&viewMode=story",
  );
  await expect(
    screen.getByRole("heading", "UI checks", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByRole("heading", "Data review", { exact: true }),
  ).toBeVisible();
  expect(
    await browser.evaluate(
      () => document.querySelectorAll(".workflow-map details").length,
    ),
  ).toBe(0);
  expect(
    await browser.evaluate(() =>
      [...document.querySelectorAll(".journey-child [data-status]")].map(
        (node) => node.getAttribute("data-status"),
      ),
    ),
  ).toEqual(["failed", "completed", "completed"]);
  await screen
    .getByRole("button", "View React in Verify", { exact: true })
    .last()
    .tap();
  const evidence = screen.getByRole("region", "React skill evidence", {
    exact: true,
  });
  await expect(
    evidence.getByRole("link", "UI verification failed"),
  ).not.toBeVisible();
  await expect(
    evidence.getByRole("link", "Child returned proposed checks"),
  ).toBeVisible();
  expect(
    await evidence
      .getByRole("link", "Declaration in trace")
      .first()
      .getAttribute("href"),
  ).toContain("child-ui%3Aretry");
  await screen.getByRole("button", "Close skill evidence").tap();
  expect(
    await browser.evaluate(
      () => document.activeElement?.getAttribute("aria-label") ?? null,
    ),
  ).toBe("View React in Verify");
  await expect
    .poll(() =>
      browser.evaluate(() => {
        const content = document.querySelector(".workflow-map");
        if (!content) return false;
        const rect = content.getBoundingClientRect();
        const anchors = [...content.querySelectorAll("[data-map-key]")];
        const paths = [...content.querySelectorAll("path[data-connection]")];
        return (
          paths.length > 0 &&
          paths.every((path) => {
            if (!(path instanceof SVGPathElement)) return false;
            const start = path.getPointAtLength(0),
              end = path.getPointAtLength(path.getTotalLength());
            return ["from", "to"].every((key, i) => {
              const anchor = anchors.find(
                (a) =>
                  a.getAttribute("data-map-key") ===
                  path.getAttribute("data-" + key),
              );
              if (!anchor) return false;
              const b = anchor.getBoundingClientRect(),
                p = i === 0 ? start : end;
              return (
                Math.abs(p.x - (b.left - rect.left + b.width / 2)) < 0.5 &&
                Math.abs(p.y - (b.top - rect.top + b.height / 2)) < 0.5
              );
            });
          })
        );
      }),
    )
    .toBe(true);
  expect(
    await browser.evaluate(() => ({
      forks: document.querySelectorAll('path[data-connection="fork"]').length,
      joins: document.querySelectorAll('path[data-connection="join"]').length,
      roots: document.querySelectorAll('path[data-connection="root"]').length,
    })),
  ).toEqual({ forks: 2, joins: 2, roots: 1 });
  await browser.evaluate(() => {
    document.querySelector(".workflow-map")?.scrollIntoView();
    return true;
  });
  await app.screenshot("connected-child-journeys-light");
  await browser.setViewport({ width: 390, height: 844 });
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await browser.evaluate(() => {
    const map = document.querySelector(".workflow-map-scroll");
    if (map instanceof HTMLElement) map.focus();
    return true;
  });
  const beforeKeyboardScroll = await browser.evaluate(
    () => document.querySelector(".workflow-map-scroll")?.scrollLeft ?? 0,
  );
  await browser.keyboard.press("ArrowRight");
  await expect
    .poll(() =>
      browser.evaluate(
        () => document.querySelector(".workflow-map-scroll")?.scrollLeft ?? 0,
      ),
    )
    .toBeGreaterThan(beforeKeyboardScroll);
  await expect(
    screen.getByRole("link", "React skill read in child trace").last(),
  ).toHaveAttribute("href", /child-ui%3Aretry.*event=/);
  await app.screenshot("connected-child-journeys-narrow-dark");
});

test("map descriptions compact revisions without losing the full value", async ({
  app,
  browser,
  screen,
}) => {
  const revision = "0123456789abcdef0123456789abcdef01234567";
  await browser.setViewport({ width: 1600, height: 1100 });
  await app.open(
    "/iframe.html?id=observatory-evaluations--revision-summaries&viewMode=story",
  );
  await expect
    .poll(() =>
      browser.evaluate(() => ({
        maps: document.querySelectorAll(".workflow-map").length,
        branches: document.querySelectorAll("[data-map-branch]").length,
        forks: document.querySelectorAll('path[data-connection="fork"]').length,
        joins: document.querySelectorAll('path[data-connection="join"]').length,
      })),
    )
    .toEqual({ maps: 1, branches: 2, forks: 2, joins: 2 });
  await expect(
    screen.getByRole("heading", "New feature", { exact: true }),
  ).toBeVisible();
  await expect(screen.getByText("01234567", { exact: true })).toHaveAttribute(
    "title",
    revision,
  );
  expect(
    await browser.evaluate(() => {
      const description = document
        .querySelector(".map-main-cell .map-revision")
        ?.closest("p");
      const main = document.querySelector("[data-map-main]");
      const child = document.querySelector("[data-map-child-stop]");
      if (!description || !main || !child) return null;
      return {
        smaller:
          parseFloat(getComputedStyle(description).fontSize) <
          parseFloat(getComputedStyle(document.body).fontSize),
        fullHashInSentence: /\b[a-f0-9]{40}\b/i.test(
          description.textContent ?? "",
        ),
        distinctBranch:
          getComputedStyle(main).borderColor !==
          getComputedStyle(child).borderColor,
      };
    }),
  ).toEqual({ smaller: true, fullHashInSentence: false, distinctBranch: true });
  const beforeCopy = await browser.evaluate(() => {
    const badge = document.querySelector(".map-revision");
    if (!badge) return null;
    const bounds = badge.getBoundingClientRect();
    return {
      width: bounds.width,
      height: bounds.height,
      text: badge.textContent,
      icon: badge.querySelector("button svg")?.innerHTML ?? null,
    };
  });
  expect(beforeCopy).not.toBeNull();
  await browser.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) =>
          sessionStorage.setItem("fixture-revision-copy", value),
      },
    });
    return true;
  });
  await screen.getByRole("button", "Copy revision", { exact: true }).tap();
  expect(
    await browser.evaluate(() =>
      sessionStorage.getItem("fixture-revision-copy"),
    ),
  ).toBe(revision);
  await expect(screen.getByText("Copied", { exact: true })).toBeVisible();
  expect(
    await browser.evaluate(() => {
      const badge = document.querySelector(".map-revision");
      if (!badge) return null;
      const bounds = badge.getBoundingClientRect();
      return {
        width: bounds.width,
        height: bounds.height,
        text: badge.textContent,
        icon: badge.querySelector("button svg")?.innerHTML ?? null,
      };
    }),
  ).toEqual(beforeCopy);
  expect(
    await browser.evaluate(
      () =>
        document.querySelector(".copy-toast")?.parentElement === document.body,
    ),
  ).toBe(true);
  await browser.evaluate(() => {
    const map = document.querySelector(".workflow-map-scroll");
    if (map)
      window.scrollTo(0, map.getBoundingClientRect().top + scrollY - 100);
    return true;
  });
  await app.screenshot("copy-toast-light");
  await expect(screen.getByRole("status")).toHaveCount(0);
  await screen.getByRole("button", "Copy revision", { exact: true }).tap();
  await screen.getByRole("button", "Copy revision", { exact: true }).tap();
  await expect(screen.getByRole("status")).toHaveCount(1);
  await browser.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("fixture-denied");
        },
      },
    });
    return true;
  });
  await screen.getByRole("button", "Copy revision", { exact: true }).tap();
  await expect(screen.getByText(revision, { exact: true })).toBeVisible();
  await expect(
    screen.getByText("Copy unavailable; select the full value.", {
      exact: true,
    }),
  ).toBeVisible();
  await browser.setViewport({ width: 390, height: 844 });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(screen.getByRole("alert")).toContainText(revision);
  expect(
    await browser.evaluate(
      () => document.querySelector(".map-revision")?.textContent ?? null,
    ),
  ).toBe("01234567");
  await screen
    .getByRole("button", "Dismiss copy notification", { exact: true })
    .tap();
  await expect(screen.getByRole("alert")).toHaveCount(0);
});

test("main rail stays centered with zero through four outward child lanes", async ({
  app,
  browser,
  screen,
}) => {
  await browser.setViewport({ width: 1600, height: 1000 });
  for (const [story, count] of [
    ["bug-fix-flow", 0],
    ["single-journey", 1],
    ["parallel-journeys", 2],
    ["three-journeys", 3],
    ["four-journeys", 4],
  ] satisfies [string, number][]) {
    await app.open(
      `/iframe.html?id=observatory-evaluations--${story}&viewMode=story`,
    );
    await expect
      .poll(() =>
        browser.evaluate(() => {
          const map = document.querySelector(".workflow-map");
          const viewport = map?.parentElement;
          const main = map?.querySelector("[data-map-main]");
          const root = map?.querySelector("[data-map-root]");
          if (!map || !viewport || !main || !root) return null;
          const center = (element: Element) => {
            const rect = element.getBoundingClientRect();
            return rect.left + rect.width / 2;
          };
          const x = center(main);
          const branches = [...map.querySelectorAll("[data-map-branch]")];
          const fork = map.querySelector("[data-map-fork]");
          const card = map.querySelector(".journey-delegation-card");
          return {
            count: branches.length,
            rootAligned: Math.abs(center(root) - x) < 1,
            mainCentered: Math.abs(center(map) - x) < 1,
            viewportCentered: Math.abs(center(viewport) - x) < 1,
            distinctLanes:
              new Set([
                x,
                ...branches.map((branch) => {
                  const stop = branch.querySelector("[data-map-child-stop]");
                  return stop ? center(stop) : null;
                }),
              ]).size ===
              branches.length + 1,
            outwardLabels: branches.every((branch, index) => {
              const stop = branch.querySelector("[data-map-child-stop]");
              const label = branch.querySelector("h4");
              if (!stop || !label) return false;
              const side = branch.getAttribute("data-side");
              const a = stop.getBoundingClientRect(),
                b = label.getBoundingClientRect();
              return index % 2 === 0
                ? side === "left" && center(stop) < x && b.right < a.left - 12
                : side === "right" && center(stop) > x && b.left > a.right + 12;
            }),
            forkCardAboveJunction:
              branches.length === 0
                ? card === null
                : !!fork &&
                  !!card &&
                  Math.abs(center(card) - x) < 1 &&
                  card.getBoundingClientRect().bottom <
                    fork.getBoundingClientRect().top - 12 &&
                  branches.every((branch) => {
                    const stop = branch.querySelector("[data-map-child-stop]");
                    return (
                      !!stop &&
                      stop.getBoundingClientRect().top >
                        fork.getBoundingClientRect().bottom
                    );
                  }),
            pageFits: document.documentElement.scrollWidth <= innerWidth,
          };
        }),
      )
      .toEqual({
        count,
        rootAligned: true,
        mainCentered: true,
        viewportCentered: true,
        distinctLanes: true,
        outwardLabels: true,
        forkCardAboveJunction: true,
        pageFits: true,
      });
  }
  await browser.evaluate(() => {
    const map = document.querySelector(".workflow-map-scroll");
    if (map) map.scrollLeft = 0;
    return true;
  });
  await screen
    .getByRole("button", "View React in Verify", { exact: true })
    .last()
    .tap();
  await expect
    .poll(() =>
      browser.evaluate(
        () =>
          document.querySelector(".workflow-map-scroll")?.scrollLeft ?? null,
      ),
    )
    .toBe(0);
  await screen
    .getByRole("region", "React skill evidence", { exact: true })
    .getByRole("button", "Close skill evidence")
    .tap();
  await browser.evaluate(() => {
    const map = document.querySelector(".workflow-map-scroll");
    if (map)
      window.scrollTo(0, map.getBoundingClientRect().top + scrollY - 100);
    return true;
  });
  await app.screenshot("centered-four-child-lanes-light");
  await browser.setViewport({ width: 390, height: 844 });
  await expect
    .poll(() =>
      browser.evaluate(() => {
        const viewport = document.querySelector(".workflow-map-scroll");
        const main = viewport?.querySelector("[data-map-main]");
        if (!viewport || !main) return false;
        const a = viewport.getBoundingClientRect(),
          b = main.getBoundingClientRect();
        const map = viewport.querySelector(".workflow-map");
        if (!map) return false;
        const rect = map.getBoundingClientRect();
        const anchors = [...map.querySelectorAll("[data-map-key]")];
        const paths = [...map.querySelectorAll("path[data-connection]")];
        const linesAligned =
          paths.length > 0 &&
          paths.every((path) => {
            if (!(path instanceof SVGPathElement)) return false;
            const start = path.getPointAtLength(0),
              end = path.getPointAtLength(path.getTotalLength());
            return ["from", "to"].every((key, index) => {
              const anchor = anchors.find(
                (item) =>
                  item.getAttribute("data-map-key") ===
                  path.getAttribute("data-" + key),
              );
              if (!anchor) return false;
              const bounds = anchor.getBoundingClientRect();
              const point = index === 0 ? start : end;
              return (
                Math.abs(point.x - bounds.left + rect.left - bounds.width / 2) <
                  0.5 &&
                Math.abs(point.y - bounds.top + rect.top - bounds.height / 2) <
                  0.5
              );
            });
          });
        return (
          Math.abs(b.left + b.width / 2 - a.left - a.width / 2) < 1 &&
          document.documentElement.scrollWidth <= innerWidth &&
          linesAligned
        );
      }),
    )
    .toBe(true);
  await app.screenshot("centered-four-child-lanes-narrow");
});

test("five child routes fit the desktop width and remain reachable on narrow screens", async ({
  app,
  browser,
}) => {
  await browser.setViewport({ width: 1600, height: 1000 });
  await app.open(
    "/iframe.html?id=observatory-evaluations--five-journeys&viewMode=story",
  );
  const visibility = () =>
    browser.evaluate(() => {
      const viewport = document.querySelector(".workflow-map-scroll");
      const map = viewport?.querySelector(".workflow-map");
      if (!viewport || !map) return null;
      const bounds = viewport.getBoundingClientRect();
      const branches = [...map.querySelectorAll("[data-map-branch]")];
      const anchors = [...map.querySelectorAll("[data-map-key]")];
      const paths = [...map.querySelectorAll("path[data-connection]")];
      const linesAligned =
        paths.length > 0 &&
        paths.every((path) => {
          if (!(path instanceof SVGPathElement)) return false;
          const matrix = path.getScreenCTM();
          if (!matrix) return false;
          const endpoints = [
            path.getPointAtLength(0),
            path.getPointAtLength(path.getTotalLength()),
          ];
          return ["from", "to"].every((key, index) => {
            const anchor = anchors.find(
              (item) =>
                item.getAttribute("data-map-key") ===
                path.getAttribute("data-" + key),
            );
            const endpoint = endpoints[index];
            if (!anchor || !endpoint) return false;
            const rect = anchor.getBoundingClientRect();
            const point = new DOMPoint(endpoint.x, endpoint.y).matrixTransform(
              matrix,
            );
            return (
              Math.abs(point.x - rect.left - rect.width / 2) < 0.5 &&
              Math.abs(point.y - rect.top - rect.height / 2) < 0.5
            );
          });
        });
      return {
        children: branches.length,
        allBranchesVisible: branches.every((branch) => {
          const rect = branch.getBoundingClientRect();
          return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
        }),
        mapFits: viewport.scrollWidth <= viewport.clientWidth + 1,
        pageFits: document.documentElement.scrollWidth <= innerWidth,
        linesAligned,
      };
    });
  for (const width of [1600, 1280, 1920]) {
    await browser.setViewport({ width, height: 1000 });
    await expect.poll(visibility).toEqual({
      children: 5,
      allBranchesVisible: true,
      mapFits: true,
      pageFits: true,
      linesAligned: true,
    });
  }
  await browser.setViewport({ width: 1600, height: 1000 });
  await browser.evaluate(() => {
    document.querySelector(".journey-delegation-card")?.scrollIntoView();
    window.scrollBy(0, -100);
    return true;
  });
  await app.screenshot("five-child-routes-full-width");
  await browser.setViewport({ width: 390, height: 844 });
  await expect.poll(visibility).toMatchObject({
    children: 5,
    pageFits: true,
    linesAligned: true,
  });
  // Narrow screens retain readable lanes; both outer routes can be panned into view.
  for (const side of ["left", "right"]) {
    await expect
      .poll(() =>
        browser.evaluate((side) => {
          const viewport = document.querySelector(".workflow-map-scroll");
          if (!viewport) return false;
          const branches = [
            ...viewport.querySelectorAll(
              `[data-map-branch][data-side="${side}"]`,
            ),
          ];
          const branch = branches.at(-1);
          if (!branch) return false;
          branch
            .querySelector("h4")
            ?.scrollIntoView({ inline: "center", block: "nearest" });
          const heading = branch.querySelector("h4")?.getBoundingClientRect();
          const bounds = viewport.getBoundingClientRect();
          return (
            !!heading &&
            heading.left >= bounds.left - 1 &&
            heading.right <= bounds.right + 1
          );
        }, side),
      )
      .toBe(true);
  }
});

test("completed and unavailable children never create an implicit parent join", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--returned-without-join&viewMode=story",
  );
  await expect(
    screen
      .getByText("No parent join recorded", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await expect(
    screen.getByRole("heading", "Join back to main", { exact: true }),
  ).not.toBeVisible();
  await app.open(
    "/iframe.html?id=observatory-evaluations--unavailable-child-journey&viewMode=story",
  );
  await expect(
    screen.getByText("The host did not expose a child conversation identity.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await browser.evaluate(
      () => document.querySelectorAll(".journey-child a").length,
    ),
  ).toBe(0);
});

test("delivery evidence connects to the last main stop and keeps captured checks separate from current PR state", async ({
  app,
  browser,
  screen,
}) => {
  await browser.route("https://raw.githubusercontent.com/**", async (route) => {
    await route.fulfill({
      headers: { "content-type": "image/svg+xml" },
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420"><rect width="900" height="420" fill="#eef3f7"/><text x="60" y="90" font-size="28" fill="#1e3548">Saved edits survive reopening</text><path d="M70 160v180" stroke="#499674" stroke-width="5"/><circle cx="70" cy="200" r="12" fill="#eef3f7" stroke="#499674" stroke-width="5"/><text x="105" y="208" font-size="22" fill="#1e3548">Save → reopen → verify</text></svg>',
    });
  });
  await browser.setViewport({ width: 1440, height: 1000 });
  await app.open(
    "/iframe.html?id=observatory-evaluations--delivered-result&viewMode=story",
  );
  const result = screen.getByRole("region", "Result summary", { exact: true });
  await expect(
    result.getByText("Delivered result", { exact: true }),
  ).toBeVisible();
  await expect(result.getByRole("region", "Captured PR checks")).toContainText(
    "1 passed · 1 skipped / neutral",
  );
  await expect(
    result.getByRole("region", "Latest PR observation"),
  ).toContainText("1 pending");
  await expect(
    result.getByRole("region", "Latest PR observation"),
  ).toContainText("PR has changed since this evidence was captured");
  await expect(
    result.getByText("Your review pending", { exact: true }),
  ).toBeVisible();
  expect(
    await result
      .getByRole("link", "Delivery evidence in trace")
      .getAttribute("href"),
  ).toContain("event=");
  await browser.evaluate(() => {
    document.querySelector("[data-result-card]")?.scrollIntoView();
    return true;
  });
  await expect
    .poll(() =>
      browser.evaluate(() => {
        const img = document.querySelector(".delivery-image img");
        return (
          img instanceof HTMLImageElement &&
          img.complete &&
          img.naturalWidth > 0
        );
      }),
    )
    .toBe(true);
  const geometry = () =>
    browser.evaluate(() => {
      const path = document.querySelector("[data-result-connection]");
      const last = [...document.querySelectorAll("[data-map-main]")].at(-1);
      const card = document.querySelector("[data-result-card]");
      if (
        !(path instanceof SVGPathElement) ||
        !last ||
        !card ||
        !path.ownerSVGElement
      )
        return null;
      const svg = path.ownerSVGElement.getBoundingClientRect();
      const from = last.getBoundingClientRect(),
        to = card.getBoundingClientRect();
      const start = path.getPointAtLength(0),
        end = path.getPointAtLength(path.getTotalLength());
      return {
        startsAtLastStop:
          Math.abs(svg.left + start.x - from.left - from.width / 2) < 0.5 &&
          Math.abs(svg.top + start.y - from.bottom) < 0.5,
        endsAtResult:
          Math.abs(svg.left + end.x - to.left - to.width / 2) < 0.5 &&
          Math.abs(svg.top + end.y - to.top) < 0.5,
        pageFits: document.documentElement.scrollWidth <= innerWidth,
      };
    });
  const connected = {
    startsAtLastStop: true,
    endsAtResult: true,
    pageFits: true,
  };
  await expect.poll(geometry).toEqual(connected);
  await result.getByText("Captured CI details", { exact: true }).tap();
  await expect(
    result.getByText("Save and reopen", { exact: true }),
  ).toBeVisible();
  await expect.poll(geometry).toEqual(connected);
  await browser.setViewport({ width: 390, height: 844 });
  await expect.poll(geometry).toEqual(connected);
  await browser.evaluate(() => {
    const viewport = document.querySelector(".workflow-map-scroll");
    if (viewport) viewport.scrollLeft = 0;
    return true;
  });
  await expect
    .poll(() =>
      browser.evaluate(
        () => document.querySelectorAll("[data-result-connection]").length,
      ),
    )
    .toBe(0);
  await browser.evaluate(() => {
    const viewport = document.querySelector(".workflow-map-scroll");
    if (viewport)
      viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
    return true;
  });
  await expect.poll(geometry).toEqual(connected);
});
test("failed private delivery and missing image previews retain honest evidence links", async ({
  app,
  browser,
  screen,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--private-delivery&viewMode=story",
  );
  const result = screen.getByRole("region", "Result summary", { exact: true });
  await expect(result.getByRole("region", "Captured PR checks")).toContainText(
    "1 failed · 1 pending",
  );
  await expect(result.getByRole("link", "Private screenshot ↗")).toBeVisible();
  expect(await browser.locator(".delivery-image img").count()).toBe(0);
  await expect(
    result.getByText("Private image — open with GitHub access", {
      exact: true,
    }),
  ).toBeVisible();
  await browser.route("https://raw.githubusercontent.com/**", async (route) => {
    await route.abort();
  });
  await app.open(
    "/iframe.html?id=observatory-evaluations--delivered-result&viewMode=story",
  );
  await browser.evaluate(() => {
    document.querySelector("[data-result-card]")?.scrollIntoView();
    return true;
  });
  await expect(
    result.getByText("Preview unavailable — open the captured image link", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    result.getByRole("link", "Synthetic saved-edit preview ↗"),
  ).toBeVisible();
  await expect(
    result.getByText("Your review pending", { exact: true }),
  ).toBeVisible();
});
test("evaluation shows connected parent skill reads without route annotations", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--observed-skills&viewMode=story",
  );
  const workflow = screen.getByRole("region", "Astack workflow", {
    exact: true,
  });
  await expect(
    workflow.getByRole("heading", "Observed skill reads", { exact: true }),
  ).toBeVisible();
  await expect(
    workflow.getByText(
      "Route and phases were not recorded in the linked capture.",
      { exact: true },
    ),
  ).toBeVisible();
  const captured = () =>
    browser.evaluate(() => ({
      labels: [
        ...document.querySelectorAll(".map-main-cell .journey-skill-read a"),
      ].map((node) => node.textContent?.trim()),
      mainLines: document.querySelectorAll('path[data-connection="main"]')
        .length,
      rootLines: document.querySelectorAll('path[data-connection="root"]')
        .length,
      promptLines: document.querySelectorAll("[data-prompt-connection]").length,
      resultLines: document.querySelectorAll("[data-result-connection]").length,
      pageFits: document.documentElement.scrollWidth <= innerWidth,
    }));
  await expect.poll(captured).toEqual({
    labels: ["Astack", "React", "Verify", "React"],
    mainLines: 4,
    rootLines: 1,
    promptLines: 1,
    resultLines: 1,
    pageFits: true,
  });
  const react = workflow.getByRole("link", "React skill read in main trace", {
    exact: true,
  });
  await expect(react).toHaveCount(2);
  expect(await react.first().getAttribute("href")).toBe(
    "#run/00000000-0000-4000-8000-000000000001%3Acodex%3Asaved-edit%3Areproduce?project=00000000-0000-4000-8000-000000000100&event=observed-skill%3A1",
  );
  await browser.setViewport({ width: 1280, height: 1100 });
  await browser.evaluate(() => {
    document.querySelector(".workflow-section")?.scrollIntoView();
    return true;
  });
  await app.screenshot("observed-parent-skill-path");
  await browser.setViewport({ width: 390, height: 844 });
  await expect.poll(captured).toEqual({
    labels: ["Astack", "React", "Verify", "React"],
    mainLines: 4,
    rootLines: 1,
    promptLines: 1,
    resultLines: 1,
    pageFits: true,
  });
});

test("recorded routes retain declared phases and disclose observed parent reads separately", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--recorded-flow-with-observed-skills&viewMode=story",
  );
  const workflow = screen.getByRole("region", "Astack workflow", {
    exact: true,
  });
  await expect(
    workflow.getByRole("heading", "Bug fix", { exact: true }),
  ).toBeVisible();
  await expect(
    workflow.getByRole("button", "View Bug fix in Reproduce", { exact: true }),
  ).toBeVisible();
  const bridge = () =>
    browser.evaluate(() => {
      const path = document.querySelector("[data-result-connection]");
      const last = [...document.querySelectorAll("[data-map-main]")]
        .filter((node) => node.checkVisibility())
        .at(-1);
      if (!(path instanceof SVGPathElement) || !last || !path.ownerSVGElement)
        return false;
      const origin = path.ownerSVGElement.getBoundingClientRect();
      const source = last.getBoundingClientRect();
      const start = path.getPointAtLength(0);
      return (
        Math.abs(origin.left + start.x - source.left - source.width / 2) <
          0.5 && Math.abs(origin.top + start.y - source.bottom) < 0.5
      );
    });
  await expect.poll(bridge).toBe(true);
  await workflow.getByText("Observed skill reads · 4", { exact: true }).tap();
  await expect(
    workflow.getByRole("link", "React skill read in main trace", {
      exact: true,
    }),
  ).toHaveCount(2);
  expect(
    await browser.evaluate(
      () =>
        document.querySelectorAll(".map-main-cell .journey-skill-read").length,
    ),
  ).toBe(4);
  await expect(
    workflow.getByRole("heading", "Bug fix", { exact: true }),
  ).toBeVisible();
  await expect.poll(bridge).toBe(true);
  await workflow.getByText("Observed skill reads · 4", { exact: true }).tap();
  await expect.poll(bridge).toBe(true);
});

test("orchestration hierarchy retains provider changes, nested children, review rounds and capture gaps", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-orchestration--nested-and-missing&viewMode=story",
  );
  await expect(
    screen.getByRole("link", "root · request-one", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByRole("link", "root · request-two", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("Review round one · completed", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("Review round two · completed", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("Unresolved child identity · failed", { exact: true }),
  ).toBeVisible();
  expect(
    await browser.evaluate(() => {
      const nested = [
        ...document.querySelectorAll("li[data-conversation-key]"),
      ].find((node) =>
        node.getAttribute("data-conversation-key")?.endsWith(":nested"),
      );
      return (
        nested?.parentElement
          ?.closest("li[data-conversation-key]")
          ?.getAttribute("data-conversation-key")
          ?.endsWith(":review") ?? false
      );
    }),
  ).toBe(true);
  await app.screenshot("orchestration-nested-synthetic");
  await browser.setViewport({ width: 390, height: 844 });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await app.open(
    "/iframe.html?id=observatory-orchestration--partial-page&viewMode=story",
  );
  await expect(
    screen
      .getByText("Parent conversation not loaded", { exact: false })
      .first(),
  ).toBeVisible();
  await expect(
    screen.getByText("Parent turns are not in the loaded pages yet.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    screen.getByRole("link", "nested · first", { exact: true }),
  ).toBeVisible();
});
