import { expect, type App, type Screen } from "e2e";

// The same user action and outcome are used before and after the fix.
export async function selectedStateStopsPlayback({ app, screen }: { app: App; screen: Screen }) {
  await expect(screen.getByRole("button", "Pause sequence")).toBeVisible();
  await expect(screen.getByRole("button", "Idle")).toHaveAttribute("aria-pressed", "true");
  await screen.getByRole("button", "Idle").tap();
  await expect(screen.getByRole("button", "Play sequence")).toBeVisible();
  await app.screenshot("selected-state-paused");
}
