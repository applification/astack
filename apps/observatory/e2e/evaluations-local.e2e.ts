import { test } from "@e2e-dev/web";
import { expect, secrets } from "e2e";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { fixtureProject } from "@astack/agent-observability/evaluation-fixtures";

const result = z
  .object({
    results: z.array(
      z.object({
        variant: z.enum(["fixed", "defective", "unavailable"]),
        evaluationId: z.string(),
      }),
    ),
  })
  .parse(
    JSON.parse(
      readFileSync(".proof/observatory-evals/local/results.json", "utf8"),
    ),
  );
for (const item of result.results) {
  test(
    "local persisted " +
      item.variant +
      " evaluation loads through owner authentication",
    async ({ app, screen, browser }) => {
      await app.open(
        "/#evaluation/" +
          encodeURIComponent(item.evaluationId) +
          "?project=" +
          fixtureProject,
      );
      await screen.getByLabel("Private access key").fill(secrets.get("viewer"));
      await screen.getByRole("button", "Open Observatory").tap();
      await expect(
        screen.getByRole("heading", "Saved edits / " + item.variant),
      ).toBeVisible();
      const verdict =
        item.variant === "fixed"
          ? "Pass"
          : item.variant === "defective"
            ? "Fail"
            : "Inconclusive";
      await expect(
        screen.getByText("Reported verification: " + verdict),
      ).toBeVisible();
      await expect(
        screen.getByText("Assessed outcome: " + verdict),
      ).toBeVisible();
      if (item.variant === "fixed") {
        await browser.setViewport({ width: 390, height: 844 });
        expect(
          await browser.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        const reviewId = crypto.randomUUID();
        for (const name of ["Intent", "bug-fix", "verify", "Outcome"]) {
          await screen
            .getByLabel(name + " verdict")
            .selectOption({ value: "pass" });
          await screen
            .getByLabel("Reason for " + name)
            .fill(
              "Local browser reviewed " +
                name +
                " against retained observations. " +
                reviewId,
            );
        }
        await screen.getByRole("button", "Save assessment").tap();
        await expect(screen.getByText("Assessment saved.")).toBeVisible();
        await browser.reload();
        await expect(
          screen.getByText(
            "Local browser reviewed Outcome against retained observations. " +
              reviewId,
          ),
        ).toBeVisible();
        await screen.getByRole("link", "Original request in trace").tap();
        await expect(
          screen.getByRole("heading", "Reproduce a lost saved edit"),
        ).toBeVisible();
        expect(
          await browser.evaluate(() => {
            const id = new URLSearchParams(location.hash.split("?")[1]).get(
              "event",
            );
            const event = document.getElementById(id ?? "");
            return {
              open: event instanceof HTMLDetailsElement && event.open,
              content:
                event?.querySelector(".event-content pre")?.textContent ?? null,
            };
          }),
        ).toEqual({
          open: true,
          content: "Fix edits disappearing after saving and reopening.",
        });
      }
      if (item.variant === "defective") {
        await screen
          .getByText("Verification context & artifact references")
          .tap();
        await browser.setViewport({ width: 390, height: 844 });
        expect(
          await browser.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
      }
    },
  );
}
