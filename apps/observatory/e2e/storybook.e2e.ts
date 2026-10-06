import { test } from "@e2e-dev/web";
import { expect } from "e2e";
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
