import { test } from "@e2e-dev/web";
import { expect } from "e2e";
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
    screen.getByText("Flow not recorded in the linked readable capture.", {
      exact: false,
    }),
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
  ).toBe(10);
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
        return (
          Math.abs(b.left + b.width / 2 - a.left - a.width / 2) < 1 &&
          document.documentElement.scrollWidth <= innerWidth
        );
      }),
    )
    .toBe(true);
  await app.screenshot("centered-four-child-lanes-narrow");
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
