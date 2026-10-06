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
      await expect(
        screen.getByText(
          item.variant === "fixed"
            ? "Checks passed"
            : item.variant === "defective"
              ? "Checks found a problem"
              : "Checks incomplete",
        ),
      ).toBeVisible();
      await expect(screen.getByRole("heading", "Path taken")).toBeVisible();
      await expect(
        screen.getByText("astack → Bug fix", { exact: true }),
      ).toBeVisible();
      await screen
        .getByText("Captured conversation · 2 turns", { exact: true })
        .tap();
      await expect(
        screen.getByRole("heading", "How the work unfolded"),
      ).toBeVisible();
      if (item.variant === "fixed") {
        await browser.setViewport({ width: 390, height: 844 });
        expect(
          await browser.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        const feedbackId = crypto.randomUUID();
        await screen.getByRole("button", "Partly", { exact: true }).tap();
        await screen
          .getByLabel("What worked or should change? (optional)")
          .fill("Local persisted outcome feedback " + feedbackId);
        await screen.getByRole("button", "Save review", { exact: true }).tap();
        await expect(screen.getByRole("status")).toContainText(
          "Your review is saved.",
        );
        await browser.reload();
        await expect(
          screen.getByText("Your review: Partly", { exact: true }).first(),
        ).toBeVisible();
        await screen.getByText("Review history", { exact: false }).tap();
        await expect(
          screen.getByText("Local persisted outcome feedback " + feedbackId, {
            exact: true,
          }),
        ).toBeVisible();
        await screen
          .getByText("Detailed intent and skill review", { exact: true })
          .tap();
        const reviewId = crypto.randomUUID();
        await screen.getByLabel("Include a flow assessment").check();
        for (const name of ["Route choice", "Flow execution"]) {
          await screen
            .getByLabel(name + " verdict", { exact: true })
            .selectOption({ value: "inconclusive" });
          await screen
            .getByLabel("Reason for " + name, { exact: true })
            .fill(
              "Local browser reviewed the synthetic captured flow. " + reviewId,
            );
        }
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
        await screen
          .getByText("Detailed intent and skill review", { exact: true })
          .tap();
        await expect(
          screen.getByText(
            "Local browser reviewed Outcome against retained observations. " +
              reviewId,
          ),
        ).toBeVisible();
        await expect(
          screen.getByText("Route choice: Inconclusive", { exact: true }),
        ).toBeVisible();
        await screen
          .getByText("Route selection evidence", { exact: true })
          .tap();
        await screen
          .getByRole("link", "Declaration in trace", { exact: true })
          .first()
          .tap();
        await expect(
          screen.getByRole("heading", "Workflow annotation", { exact: true }),
        ).toBeVisible();
        await browser.back();
        await expect(
          screen.getByRole("heading", "Saved edits / fixed", { exact: true }),
        ).toBeVisible();
        await screen.getByRole("link", "Original request in trace").tap();
        await expect(
          screen.getByRole("heading", "Reproduce a lost saved edit"),
        ).toBeVisible();
        await expect(
          screen
            .getByText("Fix edits disappearing after saving and reopening.", {
              exact: true,
            })
            .last(),
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
          .getByText("0 of 1 checks passed · what was checked?", {
            exact: true,
          })
          .tap();
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
