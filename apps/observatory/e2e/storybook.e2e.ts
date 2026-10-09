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

test("work views preserve original intent and its connection through scope and resize", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--prompt-origin&viewMode=story",
  );
  const intent = screen.getByRole("region", "Original intent", { exact: true });
  await expect(
    intent.getByRole("link", "Original request in trace"),
  ).toHaveAttribute("href", /event=/);
  expect(
    await browser.evaluate(() => ({
      quoted:
        document.querySelector(".evaluation-prompt-text")?.tagName ?? null,
      editable: !!document.querySelector(
        "[data-prompt-card] input, [data-prompt-card] textarea",
      ),
    })),
  ).toEqual({ quoted: "BLOCKQUOTE", editable: false });
  const connection = () =>
    browser.evaluate(() => {
      const path = document.querySelector("[data-prompt-connection]"),
        root = document.querySelector("[data-map-root]"),
        prompt = document.querySelector("[data-prompt-card]");
      if (
        !(path instanceof SVGPathElement) ||
        !root ||
        !prompt ||
        !path.ownerSVGElement
      )
        return false;
      const origin = path.ownerSVGElement.getBoundingClientRect(),
        from = prompt.getBoundingClientRect(),
        to = root.getBoundingClientRect(),
        start = path.getPointAtLength(0),
        end = path.getPointAtLength(path.getTotalLength());
      return (
        Math.abs(origin.left + start.x - from.left - from.width / 2) < 1 &&
        Math.abs(origin.top + start.y - from.bottom) < 1 &&
        Math.abs(origin.left + end.x - to.left - to.width / 2) < 1 &&
        Math.abs(origin.top + end.y - to.top) < 1
      );
    });
  await expect.poll(connection).toBe(true);
  await intent
    .getByText("Agreed scope · 2 clarifications", { exact: true })
    .tap();
  await expect(
    intent.getByText("Keep the map expanded and scrollable.", { exact: true }),
  ).toBeVisible();
  await screen.getByRole("button", "Graph", { exact: true }).tap();
  await expect.poll(connection).toBe(true);
  await browser.setViewport({ width: 390, height: 844 });
  await expect.poll(connection).toBe(true);
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("work story retains retries and scoped skill evidence with keyboard return", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--bug-fix-flow&viewMode=story",
  );
  await expect(
    screen.getByRole("button", "Work story", { exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await browser.evaluate(() =>
      [
        ...document.querySelectorAll(
          '.work-story [data-work-kind="phase"] .work-node-title',
        ),
      ].map((node) => node.textContent),
    ),
  ).toEqual(["Reproduce", "Repair", "Verify", "Repair", "Verify"]);
  const first = screen
    .getByRole("button", "Inspect Verify", { exact: true })
    .first();
  await expect(first).toContainText("Failed · agent reported");
  await first.press("Enter");
  const inspector = screen.getByRole("complementary", "Work evidence", {
    exact: true,
  });
  await expect(
    inspector.getByRole("heading", "Verify", { exact: true }),
  ).toBeFocused();
  await inspector
    .getByRole("button", "View Testing in Verify", { exact: true })
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
  ).toHaveCount(0);
  await expect(
    evidence.getByRole("link", "Declaration in trace"),
  ).toHaveAttribute("href", /event=/);
  await screen.getByRole("button", "Close skill evidence").tap();
  await expect(
    inspector.getByRole("button", "View Testing in Verify", { exact: true }),
  ).toBeFocused();
  await inspector.getByRole("button", "Back to selected step").tap();
  await expect(first).toBeFocused();
  await screen
    .getByRole("button", "Inspect Verify", { exact: true })
    .last()
    .tap();
  await expect(
    inspector.getByRole(
      "link",
      "After repair: reopen and fresh store read retain the edit",
    ),
  ).toBeVisible();
  await expect(
    inspector.getByRole(
      "link",
      "First verification: fresh read still returns old value",
    ),
  ).toHaveCount(0);
});

test("phase details retain recorded skill names, omissions, unfinished phases and icon evidence", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--skill-capture-gaps&viewMode=story",
  );
  await screen.getByRole("button", "Inspect Implement", { exact: true }).tap();
  await screen.getByRole("button", "View React in Implement").tap();
  await expect(
    screen.getByRole("region", "React skill evidence"),
  ).toContainText("Recorded name: applification:react.");
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
  await screen.getByRole("button", "Inspect Verify", { exact: true }).tap();
  await expect(
    screen.getByText("No skills declared for this phase.", { exact: true }),
  ).toBeVisible();
  await screen.getByRole("button", "Inspect Review", { exact: true }).tap();
  await screen.getByRole("button", "View PR in Review").tap();
  await expect(screen.getByRole("region", "PR skill evidence")).toContainText(
    "Preparing the PR with retained verification evidence.",
  );
  await expect
    .poll(() =>
      browser.evaluate(() => {
        const img = document.querySelector(
          'button[aria-label="View PR in Review"] img',
        );
        return (
          img instanceof HTMLImageElement &&
          img.complete &&
          img.naturalWidth > 0 &&
          img.getAttribute("src") === "/providers/github.svg"
        );
      }),
    )
    .toBe(true);
  await browser.setViewport({ width: 360, height: 800 });
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    screen.getByText("Your review pending", { exact: true }),
  ).toBeVisible();
  await app.open(
    "/iframe.html?id=observatory-evaluations--new-feature-flow&viewMode=story",
  );
  await expect(
    screen.getByRole("button", "Inspect Design", { exact: true }),
  ).toContainText("Omitted");
  await expect(
    screen.getByRole("button", "Inspect Review", { exact: true }),
  ).toContainText("Started");
  await expect(
    screen.getByRole("button", "Inspect Design", { exact: true }),
  ).toContainText("Reuse the agreed editor layout");
});

test("work views retain route changes, missing route selection and unavailable phase evidence", async ({
  app,
  screen,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--changed-flow&viewMode=story",
  );
  await expect(
    screen.getByRole("button", "Inspect Investigation", { exact: true }),
  ).toBeVisible();
  await screen
    .getByRole("button", "Inspect Route changed", { exact: true })
    .tap();
  await expect(
    screen.getByRole("complementary", "Work evidence"),
  ).toContainText("The reproduction confirmed a persistence defect");
  await app.open(
    "/iframe.html?id=observatory-evaluations--missing-flow-selection&viewMode=story",
  );
  await expect(
    screen.getByText(/route selection is unavailable/),
  ).toBeVisible();
  await expect(screen.getByRole("status")).toContainText("display limit");
  await app.open(
    "/iframe.html?id=observatory-evaluations--missing-flow-evidence&viewMode=story",
  );
  await screen
    .getByRole("button", "Inspect Verify", { exact: true })
    .first()
    .tap();
  await screen
    .getByRole("button", "View Testing in Verify", { exact: true })
    .tap();
  await expect(
    screen.getByRole("region", "Testing skill evidence"),
  ).toContainText("Referenced trace event has not been captured.");
  await app.open(
    "/iframe.html?id=observatory-evaluations--awaiting-review&viewMode=story",
  );
  await expect(
    screen.getByText(/Route and phases were not recorded/),
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
    "/iframe.html?id=observatory-trace--host-observations-uploaded&viewMode=story",
  );
  await expect(screen.getByRole("status")).toHaveText(
    "1 of 1 events uploaded. Trace up to date. 2 host observations loaded separately.",
  );
  await expect(
    screen.getByText("Host result present", { exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByText("Host result delivered", { exact: true }),
  ).toBeVisible();
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

test("work views preserve child selection, separate attempts and the same evidence links", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--parallel-journeys&viewMode=story",
  );
  const child = screen.getByRole("button", "Inspect UI checks", {
    exact: true,
  });
  await child.tap();
  const inspector = screen.getByRole("complementary", "Work evidence", {
    exact: true,
  });
  await expect(inspector).toContainText("Parent declared use");
  await expect(
    inspector.getByRole("link", "Open child turn 1 · failed"),
  ).toBeVisible();
  await expect(
    inspector.getByRole("link", "Open child turn 2 · completed"),
  ).toBeVisible();
  const links = await inspector
    .getByRole("link")
    .all()
    .then(async (items) =>
      Promise.all(items.map((item) => item.getAttribute("href"))),
    );
  await inspector.getByText("Verify · completed", { exact: true }).tap();
  await inspector
    .getByRole("button", "View React in Verify", { exact: true })
    .tap();
  const evidence = screen.getByRole("region", "React skill evidence", {
    exact: true,
  });
  await expect(
    evidence.getByRole("link", "UI verification failed"),
  ).toHaveCount(0);
  await expect(
    evidence.getByRole("link", "Child returned proposed checks"),
  ).toBeVisible();
  await expect(
    evidence.getByRole("link", "Declaration in trace").first(),
  ).toHaveAttribute("href", /child-ui%3Aretry/);
  await screen.getByRole("button", "Close skill evidence").tap();
  await screen.getByRole("button", "Graph", { exact: true }).tap();
  await expect(child).toHaveAttribute("aria-pressed", "true");
  await expect(
    inspector.getByRole("heading", "UI checks", { exact: true }),
  ).toBeVisible();
  await expect(
    inspector.getByRole("link", "Open child turn 2 · completed"),
  ).toHaveAttribute("href", links[1] ?? "");
  await screen.getByRole("button", "Work story", { exact: true }).tap();
  await inspector.getByRole("button", "Back to selected step").tap();
  await expect(child).toBeFocused();
  await app.screenshot("work-story-child-evidence");
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
  await screen.getByRole("button", "Inspect Implement", { exact: true }).tap();
  await expect(screen.getByText("01234567", { exact: true })).toHaveAttribute(
    "title",
    revision,
  );
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
    const map = document.querySelector(".work-inspector");
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

test("network layouts, expansion, filters and keyboard inspection preserve captured identities", async ({
  app,
  screen,
  browser,
}) => {
  await browser.setViewport({ width: 1500, height: 1050 });
  await app.open(
    "/iframe.html?id=observatory-evaluations--network-explorer&viewMode=story",
  );
  const canvas = screen.getByRole("group", "Captured work graph", {
    exact: true,
  });
  await expect(screen.getByLabel("Graph layout")).toHaveValue("force");
  expect(
    await browser.evaluate(
      () =>
        document.querySelectorAll('.work-network [data-work-kind="turn"]')
          .length,
    ),
  ).toBe(0);
  await screen.getByRole("button", "Expand all", { exact: true }).tap();
  expect(
    await browser.evaluate(
      () =>
        document.querySelectorAll('.work-network [data-work-kind="turn"]')
          .length,
    ),
  ).toBe(5);
  const endpoints = () =>
    browser.evaluate(() =>
      [...document.querySelectorAll(".work-network [data-work-edge]")].map(
        (edge) => [
          edge.getAttribute("data-work-edge"),
          edge.getAttribute("data-work-from"),
          edge.getAttribute("data-work-to"),
        ],
      ),
    );
  const before = await endpoints();
  await screen
    .getByLabel("Graph layout")
    .selectOption({ value: "communities" });
  await expect(
    screen.getByText("Colors group visible connectivity", { exact: false }),
  ).toBeVisible();
  expect(await endpoints()).toEqual(before);
  await app.screenshot("work-network-communities");
  await screen.getByLabel("Graph layout").selectOption({ value: "layered" });
  expect(await endpoints()).toEqual(before);
  await screen.getByLabel("Graph layout").selectOption({ value: "force" });
  const test = screen
    .getByRole("button", "Inspect Captured child test result", { exact: true })
    .first();
  await test.focus();
  await browser.keyboard.press("Enter");
  const inspector = screen.getByRole("complementary", "Work evidence");
  await expect(
    inspector.getByRole("heading", "Captured child test result", {
      exact: true,
    }),
  ).toBeFocused();
  await expect(inspector).toContainText("Occurrence time unavailable");
  const trace = await inspector
    .getByRole("link", "Event in full trace", { exact: true })
    .getAttribute("href");
  await screen.getByRole("button", "Filters", { exact: true }).tap();
  await screen.getByRole("checkbox", "Activity", { exact: true }).uncheck();
  await expect(
    screen.getByText("The selected item is hidden", { exact: false }),
  ).toBeVisible();
  await expect(
    inspector.getByRole("link", "Event in full trace", { exact: true }),
  ).toHaveAttribute("href", trace ?? "");
  await screen.getByRole("checkbox", "Activity", { exact: true }).check();
  await screen
    .getByRole("checkbox", "Activity", { exact: true })
    .press("Escape");
  await inspector
    .getByRole("button", "Close inspection", { exact: true })
    .tap();
  await expect(test).toBeFocused();
  const initial = await canvas.getAttribute("viewBox");
  await screen.getByRole("button", "Zoom in", { exact: true }).tap();
  expect(await canvas.getAttribute("viewBox")).not.toBe(initial);
  await screen.getByRole("button", "Fit graph", { exact: true }).tap();
  await expect(canvas).toHaveAttribute("viewBox", initial ?? "");
  await screen.getByRole("button", "Overview", { exact: true }).tap();
  expect(
    await browser.evaluate(
      () =>
        document.querySelectorAll('.work-network [data-work-kind="turn"]')
          .length,
    ),
  ).toBe(0);
  await screen
    .getByRole("button", "Inspect Parent conversation", { exact: true })
    .tap();
  await inspector
    .getByRole("button", "Show captured activity", { exact: true })
    .tap();
  expect(
    await browser.evaluate(
      () =>
        document.querySelectorAll('.work-network [data-work-kind="turn"]')
          .length,
    ),
  ).toBe(2);
  await screen.getByRole("button", "Filters", { exact: true }).tap();
  await screen
    .getByLabel("Graph relationships")
    .selectOption({ value: "delegation" });
  expect(
    await browser.evaluate(() =>
      [...document.querySelectorAll(".work-network [data-work-edge]")].map(
        (edge) => edge.getAttribute("data-work-edge"),
      ),
    ),
  ).toEqual(["delegation", "capture", "delegation", "capture"]);
  await screen.getByLabel("Graph relationships").selectOption({ value: "all" });
  await screen.getByLabel("Graph relationships").press("Escape");
  await screen.getByRole("button", "Expand all", { exact: true }).tap();
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  await app.screenshot("work-network-force-dark");
});

test("graph previews stay separate from selection and inspection preserves the viewport", async ({
  app,
  screen,
  browser,
}) => {
  await browser.setViewport({ width: 1440, height: 1000 });
  await app.open(
    "/iframe.html?id=observatory-evaluations--network-explorer&viewMode=story",
  );
  const inspector = screen.getByRole("complementary", "Work evidence");
  const canvas = screen.getByRole("group", "Captured work graph");
  await expect(inspector).toHaveCount(0);
  expect(
    await browser.evaluate(() => {
      const canvas = document.querySelector(".work-network");
      const workspace = document.querySelector(".work-content");
      return canvas && workspace
        ? canvas.getBoundingClientRect().width /
            workspace.getBoundingClientRect().width
        : 0;
    }),
  ).toBeGreaterThan(0.95);
  const node = screen.getByRole("button", "Inspect UI checks", { exact: true });
  await node.scrollIntoView();
  await node.hover();
  await expect(screen.getByRole("tooltip")).toContainText("DELEGATED TASK");
  await expect(screen.getByRole("tooltip")).toContainText("UI checks");
  await expect(node).toHaveAttribute("aria-describedby", /.+/);
  await screen.getByRole("tooltip").hover();
  await expect(screen.getByRole("tooltip")).toBeVisible();
  await expect(inspector).toHaveCount(0);
  await node.press("Escape");
  await expect(screen.getByRole("tooltip")).toHaveCount(0);
  await browser.mouse.move(0, 0);
  await canvas.focus();
  await node.focus();
  await expect(screen.getByRole("tooltip")).toContainText("Select to inspect");
  const before = await canvas.getAttribute("viewBox");
  await node.press("Enter");
  await expect(inspector.getByRole("heading", "UI checks")).toBeFocused();
  await expect(canvas).toHaveAttribute("viewBox", before ?? "");
  await inspector.getByRole("button", "Close inspection").tap();
  await expect(inspector).toHaveCount(0);
  await expect(node).toBeFocused();
  await node.press("Enter");
  await inspector.getByRole("heading", "UI checks").press("Escape");
  await expect(inspector).toHaveCount(0);
  await expect(node).toBeFocused();
  await expect(canvas).toHaveAttribute("viewBox", before ?? "");
});

for (const zoomed of [false, true])
  test(`keyboard graph navigation reveals covered targets at ${zoomed ? "increased zoom" : "fit scale"}`, async ({
    app,
    screen,
    browser,
  }) => {
    await browser.setViewport({ width: 1280, height: 800 });
    await app.open(
      "/iframe.html?id=observatory-evaluations--network-explorer&viewMode=story",
    );
    if (zoomed)
      await screen.getByRole("button", "Zoom in", { exact: true }).tap();
    const canvas = screen.getByRole("group", "Captured work graph");
    const parent = screen.getByRole("button", "Inspect Parent conversation", {
      exact: true,
    });
    await parent.focus();
    const before = (await canvas.getAttribute("viewBox"))
      ?.split(" ")
      .map(Number);
    await parent.press("Enter");
    const inspector = screen.getByRole("complementary", "Work evidence");
    await expect(
      inspector.getByRole("heading", "Parent conversation", { exact: true }),
    ).toBeFocused();
    await expect(canvas).toHaveAttribute("viewBox", before?.join(" ") ?? "");
    for (let step = 0; step < 11; step++)
      await browser.keyboard.press("Shift+Tab");
    const node = screen.getByRole(
      "button",
      "Inspect UI checks · conversation",
      {
        exact: true,
      },
    );
    await expect(node).toBeFocused();
    expect(
      await browser.evaluate(() => {
        const focused = document.activeElement;
        const circle = focused
          ?.querySelector("circle")
          ?.getBoundingClientRect();
        const panel = document
          .querySelector(".graph-inspector")
          ?.getBoundingClientRect();
        const graph = document
          .querySelector(".work-network")
          ?.getBoundingClientRect();
        const header = document
          .querySelector(".app-header")
          ?.getBoundingClientRect();
        const center =
          circle &&
          document.elementFromPoint(
            (circle.left + circle.right) / 2,
            (circle.top + circle.bottom) / 2,
          );
        return (
          !!circle &&
          !!panel &&
          !!graph &&
          !!focused?.matches(":focus-visible") &&
          circle.right < panel.left &&
          circle.left >= graph.left &&
          circle.top >= Math.max(0, graph.top, header?.bottom ?? 0) &&
          circle.bottom <= Math.min(graph.bottom, innerHeight) &&
          center?.closest("[data-work-id]") === focused
        );
      }),
    ).toBe(true);
    const after = (await canvas.getAttribute("viewBox"))
      ?.split(" ")
      .map(Number);
    expect(after?.slice(2)).toEqual(before?.slice(2));
    await node.press("Enter");
    await expect(
      inspector.getByRole("heading", "UI checks · conversation", {
        exact: true,
      }),
    ).toBeFocused();
    await inspector.getByRole("button", "Close inspection").tap();
    await expect(node).toBeFocused();
  });

test("graph relationships expose supporting capture and endpoint navigation across views", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--network-explorer&viewMode=story",
  );
  await screen.getByRole("button", "Expand all").tap();
  const node = screen
    .getByRole("button", "Inspect Captured child test result", { exact: true })
    .first();
  const nodeId = await node.getAttribute("data-work-id");
  const edge = browser.locator(
    `.work-network [data-work-edge="records"][data-work-to=${JSON.stringify(nodeId)}]`,
  );
  await edge.focus();
  await expect(screen.getByRole("tooltip")).toContainText(
    "Captured child test result",
  );
  await expect(screen.getByRole("tooltip")).toContainText("→");
  await expect(edge).toHaveAttribute("aria-describedby", /.+/);
  await edge.press("Space");
  const inspector = screen.getByRole("complementary", "Work evidence");
  await expect(
    inspector.getByRole("heading", "Recorded activity"),
  ).toBeFocused();
  await expect(inspector).toContainText("does not establish an event time");
  await expect(inspector).toContainText("Occurrence time unavailable");
  const trace = await inspector
    .getByRole("link", "Event in full trace")
    .getAttribute("href");
  await screen.getByRole("button", "Work story", { exact: true }).tap();
  await expect(
    inspector.getByRole("link", "Event in full trace"),
  ).toHaveAttribute("href", trace ?? "");
  await expect(inspector).not.toContainText(
    "unavailable in the current work capture",
  );
  await screen.getByRole("button", "Graph", { exact: true }).tap();
  await inspector.getByRole("button", "Close inspection").tap();
  await expect(edge).toBeFocused();
  await edge.press("Enter");
  await inspector
    .getByRole("button", "Inspect destination node: Captured child test result")
    .tap();
  await expect(
    inspector.getByRole("heading", "Captured child test result"),
  ).toBeFocused();
  await screen.getByRole("button", "Work story", { exact: true }).tap();
  await expect(inspector).toContainText("Occurrence time unavailable");
  await screen.getByRole("button", "Graph", { exact: true }).tap();
  await screen.getByRole("button", "Filters", { exact: true }).tap();
  await screen.getByRole("checkbox", "Activity").uncheck();
  await screen.getByRole("checkbox", "Activity").press("Escape");
  await expect(
    screen.getByText("The selected item is hidden", { exact: false }),
  ).toBeVisible();
  await expect(
    inspector.getByRole("link", "Event in full trace"),
  ).toHaveAttribute("href", trace ?? "");
  await inspector.getByRole("button", "Close inspection").tap();
  await expect(screen.getByRole("group", "Captured work graph")).toBeFocused();
  await expect(
    screen.getByText("Show it again to reopen its evidence.", { exact: false }),
  ).toBeVisible();
  await expect(
    screen.getByText("Its evidence remains in the inspector.", {
      exact: false,
    }),
  ).toHaveCount(0);
  await browser
    .locator('.work-network [data-work-edge="capture"] .work-network-hit')
    .first()
    .tap();
  await expect(
    inspector.getByRole("heading", "Captured child conversation"),
  ).toBeFocused();
  await expect(inspector).toContainText("Task completion");
});

test("graph filters are grouped, dismissible and resettable on a narrow screen", async ({
  app,
  screen,
  browser,
}) => {
  await browser.setViewport({ width: 390, height: 844 });
  await app.open(
    "/iframe.html?id=observatory-evaluations--network-explorer&viewMode=story",
  );
  const filters = screen.getByRole("button", "Filters", { exact: true });
  await filters.focus();
  await filters.press("Enter");
  await expect(screen.getByLabel("Graph relationships")).toBeFocused();
  const panel = screen.getByRole("region", "Graph filters");
  await expect(panel).toBeVisible();
  expect(
    await browser.evaluate(() => {
      const bounds = document
        .querySelector(".graph-disclosure-panel")
        ?.getBoundingClientRect();
      return !!bounds && bounds.left >= 0 && bounds.right <= innerWidth;
    }),
  ).toBe(true);
  await screen.getByRole("checkbox", "Activity").uncheck();
  await screen.getByRole("checkbox", "Supporting evidence").uncheck();
  const restricted = screen.getByRole("button", "Filters · 2 active", {
    exact: true,
  });
  await expect(restricted).toHaveAttribute("aria-expanded", "true");
  await screen.getByRole("button", "Reset filters").tap();
  await expect(screen.getByRole("checkbox", "Activity")).toBeChecked();
  await expect(
    screen.getByRole("checkbox", "Supporting evidence"),
  ).toBeChecked();
  await screen.getByRole("checkbox", "Supporting evidence").press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(filters).toBeFocused();
  await filters.tap();
  await screen.getByLabel("Graph layout").focus();
  await expect(panel).toHaveCount(0);
  await filters.tap();
  await screen.getByRole("button", "Expand all").tap();
  await expect(panel).toHaveCount(0);
  await screen
    .getByRole("button", "Inspect Captured child test result", { exact: true })
    .first()
    .focus();
  await browser.keyboard.press("Enter");
  const inspector = screen.getByRole("complementary", "Work evidence");
  await expect(inspector).toContainText("Occurrence time unavailable");
  expect(
    await browser.evaluate(() => {
      const canvas = document
        .querySelector(".work-network")
        ?.getBoundingClientRect();
      const inspector = document
        .querySelector(".graph-inspector")
        ?.getBoundingClientRect();
      return (
        !!canvas &&
        !!inspector &&
        inspector.top >= canvas.bottom &&
        document.documentElement.scrollWidth <= innerWidth
      );
    }),
  ).toBe(true);
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  await app.screenshot("work-network-inspection-narrow");
  await inspector.getByRole("button", "Close inspection").tap();
  await expect(inspector).toHaveCount(0);
});

test("graph connects separate dispatches and explicit use without inventing result receipt", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--parallel-journeys&viewMode=story",
  );
  await screen.getByRole("button", "Graph", { exact: true }).tap();
  expect(
    await browser.evaluate(() => ({
      dispatch: document.querySelectorAll('[data-work-edge="delegation"]')
        .length,
      use: document.querySelectorAll('[data-work-edge="declared_use"]').length,
      result: document.querySelectorAll('[data-work-edge="result"]').length,
    })),
  ).toEqual({ dispatch: 2, use: 2, result: 0 });
  expect(
    await browser.evaluate(() =>
      [...document.querySelectorAll('[data-work-edge="delegation"]')].map(
        (path) =>
          document
            .querySelector(
              '[data-work-id="' +
                CSS.escape(path.getAttribute("data-work-from") ?? "") +
                '"]',
            )
            ?.getAttribute("data-work-kind") ?? null,
      ),
    ),
  ).toEqual(["conversation", "conversation"]);
  expect(
    await browser.evaluate(() =>
      [...document.querySelectorAll("[data-work-edge]")].every((path) =>
        ["from", "to"].every((end) =>
          [...document.querySelectorAll("[data-work-id]")].some(
            (node) =>
              node.getAttribute("data-work-id") ===
              path.getAttribute("data-work-" + end),
          ),
        ),
      ),
    ),
  ).toBe(true);
  await screen.getByRole("button", "Inspect UI checks", { exact: true }).tap();
  await app.screenshot("work-graph-explicit-use");
});

test("completed, unresolved-use and unavailable children keep independent unknown states", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--returned-without-join&viewMode=story",
  );
  await screen.getByRole("button", "Inspect UI checks", { exact: true }).tap();
  const inspector = screen.getByRole("complementary", "Work evidence");
  await expect(inspector).toContainText("completed · host reported");
  await expect(inspector).toContainText("Not recorded · unknown");
  await expect(inspector).toContainText("Parent use not recorded");
  await screen.getByRole("button", "Graph", { exact: true }).tap();
  expect(
    await browser.evaluate(
      () =>
        document.querySelectorAll(
          '[data-work-edge="declared_use"], [data-work-edge="delivered"], [data-work-edge="acknowledged"]',
        ).length,
    ),
  ).toBe(0);
  await app.open(
    "/iframe.html?id=observatory-evaluations--unresolved-parent-use&viewMode=story",
  );
  await screen.getByRole("button", "Inspect UI checks", { exact: true }).tap();
  await expect(inspector).toContainText("Use declared · evidence unavailable");
  await expect(inspector).toContainText(
    "Referenced child result has not been captured.",
  );
  await screen.getByRole("button", "Graph", { exact: true }).tap();
  expect(
    await browser.evaluate(() => ({
      use: document.querySelectorAll('[data-work-edge="declared_use"]').length,
      unresolved: document.querySelectorAll('[data-work-edge="unresolved_use"]')
        .length,
    })),
  ).toEqual({ use: 0, unresolved: 2 });
  await app.open(
    "/iframe.html?id=observatory-evaluations--unavailable-child-journey&viewMode=story",
  );
  await screen
    .getByRole("button", "Inspect Uncaptured child", { exact: true })
    .tap();
  await expect(inspector).toContainText(
    "The host did not expose a child conversation identity.",
  );
  await expect(
    screen.getByRole("button", "Inspect Delegate: Uncaptured child", {
      exact: true,
    }),
  ).toContainText("Dispatch time unavailable");
});

test("five child contributions stay reachable in both views without document overflow", async ({
  app,
  screen,
  browser,
}) => {
  await browser.setViewport({ width: 1440, height: 1000 });
  await app.open(
    "/iframe.html?id=observatory-evaluations--five-journeys&viewMode=story",
  );
  await expect(
    browser.locator('.work-story [data-work-kind="contribution"]'),
  ).toHaveCount(5);
  await browser.setViewport({ width: 390, height: 844 });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await screen
    .getByRole("button", "Inspect Documentation checks", { exact: true })
    .tap();
  await expect(
    screen.getByRole("complementary", "Work evidence"),
  ).toContainText("no readable capture");
  await screen.getByRole("button", "Graph", { exact: true }).tap();
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const graph = screen.getByRole("group", "Captured work graph", {
    exact: true,
  });
  await graph.focus();
  const before = await browser.evaluate(
    () =>
      document.querySelector(".work-network")?.getAttribute("viewBox") ?? "",
  );
  await browser.keyboard.press("ArrowRight");
  await expect
    .poll(() =>
      browser.evaluate(
        () =>
          document.querySelector(".work-network")?.getAttribute("viewBox") ??
          "",
      ),
    )
    .not.toBe(before);
  await screen
    .getByRole("button", "Inspect Security review", { exact: true })
    .last()
    .tap();
  await expect(
    screen
      .getByRole("complementary", "Work evidence")
      .getByRole("heading", "Security review", { exact: true }),
  ).toBeVisible();
  await screen.getByLabel("Color theme").selectOption({ value: "dark" });
  await app.screenshot("work-graph-narrow-dark");
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
test("observed reads stay compact and preserve repeated skill links separately from phases", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--observed-skills&viewMode=story",
  );
  await screen
    .getByRole("button", "Inspect Observed skill reads", { exact: true })
    .tap();
  const inspector = screen.getByRole("complementary", "Work evidence");
  await expect(inspector).toContainText(
    "Reads do not establish how a skill was applied.",
  );
  await expect(
    inspector.getByRole("link", "React", { exact: true }),
  ).toHaveCount(2);
  await expect(
    inspector.getByRole("link", "React", { exact: true }).first(),
  ).toHaveAttribute("href", /event=observed-skill%3A1/);
  await browser.setViewport({ width: 390, height: 844 });
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await app.open(
    "/iframe.html?id=observatory-evaluations--recorded-flow-with-observed-skills&viewMode=story",
  );
  await expect(
    screen.getByRole("button", "Inspect Bug fix", { exact: true }),
  ).toBeVisible();
  await screen
    .getByRole("button", "Inspect Observed skill reads", { exact: true })
    .tap();
  await expect(
    inspector.getByRole("link", "React", { exact: true }),
  ).toHaveCount(2);
  await screen.getByRole("button", "Inspect Reproduce", { exact: true }).tap();
  await expect(
    inspector.getByRole("button", "View Bug fix in Reproduce", { exact: true }),
  ).toBeVisible();
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
  await app.open(
    "/iframe.html?id=observatory-orchestration--missing-intermediate&viewMode=story",
  );
  await expect(
    screen
      .getByText("Parent conversation capture unavailable", { exact: false })
      .first(),
  ).toBeVisible();
  await expect(
    screen.getByText("Parent conversation not loaded", { exact: false }),
  ).toHaveCount(0);
});

test("host presence, delivery and acknowledgement remain independent and return edges need receipt evidence", async ({
  app,
  screen,
  browser,
}) => {
  await app.open(
    "/iframe.html?id=observatory-evaluations--host-result-observations&viewMode=story",
  );
  await screen.getByRole("button", "Inspect UI checks", { exact: true }).tap();
  const inspector = screen.getByRole("complementary", "Work evidence");
  await expect(inspector).toContainText("Observed in parent capture");
  await expect(inspector).toContainText("Host marked delivered");
  await expect(inspector).toContainText("Parent use not recorded");
  await screen
    .getByRole("button", "Inspect Data review", { exact: true })
    .tap();
  await expect(inspector).toContainText("Terminal-result read recorded");
  expect(
    await browser.evaluate(() =>
      [...document.querySelectorAll(".work-facts > div")].map((node) => [
        node.querySelector("dt")?.textContent ?? null,
        node.querySelector("dd")?.textContent ?? null,
      ]),
    ),
  ).toContain(["Host delivery", "Not recorded · unknown"]);
  await screen
    .getByRole("button", "Inspect Terminal result acknowledged", {
      exact: true,
    })
    .tap();
  const href = await inspector
    .getByRole("link", "Result observation in parent trace")
    .getAttribute("href");
  await screen.getByRole("button", "Graph", { exact: true }).tap();
  await expect(
    screen.getByRole("button", "Inspect Terminal result acknowledged", {
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    inspector.getByRole("link", "Result observation in parent trace"),
  ).toHaveAttribute("href", href ?? "");
  expect(
    await browser.evaluate(() => ({
      returns: document.querySelectorAll(
        '[data-work-edge="delivered"], [data-work-edge="acknowledged"]',
      ).length,
      uses: document.querySelectorAll('[data-work-edge="declared_use"]').length,
      presenceReturn: [
        ...document.querySelectorAll(
          '[data-work-edge="delivered"], [data-work-edge="acknowledged"]',
        ),
      ].some((node) =>
        node.getAttribute("data-work-from")?.includes("-present"),
      ),
    })),
  ).toEqual({ returns: 2, uses: 0, presenceReturn: false });
  await app.screenshot("work-graph-result-observations");
  await screen.getByRole("button", "Work story", { exact: true }).tap();
  await inspector.getByRole("button", "Back to selected step").tap();
  await expect(
    screen.getByRole("button", "Inspect Terminal result acknowledged", {
      exact: true,
    }),
  ).toBeFocused();
});
