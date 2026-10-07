import { deliveryEvidenceSchema } from "./delivery-evidence";
export function deliveryFixture() {
  const head = "a".repeat(40);
  return deliveryEvidenceSchema.parse({
    snapshot: {
      schemaVersion: 1,
      capturedAt: Date.UTC(2026, 9, 7, 9),
      repository: "applification/astack",
      number: 26,
      url: "https://github.com/applification/astack/pull/26",
      title: "Preserve saved edits after reopening",
      summary:
        "Saved edits now survive reopening. The route shows the work and its verification evidence.",
      visibility: "public",
      headRevision: head,
      state: "open",
      draft: false,
      checks: [
        {
          name: "Save and reopen",
          status: "completed",
          conclusion: "success",
          url: "https://github.com/applification/astack/actions/runs/1",
        },
        {
          name: "Advisory exploration",
          status: "completed",
          conclusion: "skipped",
          url: null,
        },
      ],
      media: [
        {
          kind: "image",
          label: "Synthetic saved-edit preview",
          url: "https://raw.githubusercontent.com/applification/astack/f8becdbf7d08aa8a78eea9152dd49c76ad93defb/.astack/observatory-journeys/evidence/prompt-origin-light.png",
          path: ".astack/observatory-journeys/evidence/prompt-origin-light.png",
          revision: "f8becdbf7d08aa8a78eea9152dd49c76ad93defb",
          sha256:
            "996d7556e6215ccdbd8ec29b7e446860fbba39615fba5cf860d861ffc67dcccc",
        },
      ],
    },
    current: {
      observedAt: Date.UTC(2026, 9, 7, 9, 5),
      headRevision: "c".repeat(40),
      state: "open",
      draft: false,
      checks: [
        {
          name: "Regression checks",
          status: "in_progress",
          conclusion: null,
          url: null,
        },
      ],
    },
  });
}
