# Captured request evaluations

Generate evaluation calls the existing owner-authorized Convex mutation with a run/project identity. New UI and agent-generated evaluations reference the captured original request and revision; the backend preserves that request once in the immutable source snapshot. Existing declared/imported evaluations remain readable. No model service or automatic owner judgment is added.

- A1: A readable 5,633-character request generates a persisted review and retains its full text after reload. Its fallback criterion refers to the original request without copying its text into evaluation metadata.
- A2: Original request snapshots survive later capture revisions. Old manifests remain readable; source/run identity and captured revision are checked on both collector and backend boundaries. Owner/project/capture-policy checks and concurrent retry idempotency remain intact.
- A3: Captured text uses the existing 128 KiB record and 512 KiB snapshot byte budgets. Missing/unreadable requests and oversized records/snapshots produce specific application errors. Rejected writes leave no partial evaluation.

Pen is skipped because the change preserves the existing layout. Storybook is selected for long-request rendering and expected application-error/retry states. A real anonymous Convex deployment and the existing local browser suite will verify generation, reload and existing-evaluation compatibility. Synthetic fixtures are used in retained screenshots; the private Loami prompt is not committed.

Backend-first rollout is required before the updated collector/UI. This change does not deploy to Otis or merge its PR.

## Verification

Before implementation, the new long-request regression failed on commit `312b018e830268dfeb2d8d7a2ea87c67e7deea00` with two 4,096-character validation errors: `intent.request` and `cases[0].expected`.

All acceptance cases pass on the changed tree based on `4940ee274a7bbc2366f53294889a1548b5388701`. [Verification](verification.md) records the environment, observed checks, review result and remaining rollout boundary. [The fresh owner read](post-browser-read.json) confirms the browser-created review contains the full 5,633-character captured request, keeps one evaluation after retry and saves none for the missing-request case.
