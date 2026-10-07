# Evaluation generation

Agents using Astack with enrolled readable capture automatically record task criteria at the start and queue an evaluation at delivery. The collector publishes after the selected final turn is captured. An owner can generate a fallback review from a captured turn in Observatory.

- A1: Begin/finish survive collector restart and capture lag. The evaluation preserves the original prompt, recorded criteria, selected task turns and supplied proof. Identical retries publish once; changed scope needs a new task.
- A2: Generate evaluation creates an owner-authorized review from the selected turn's exact captured request. Retries open the existing generated review. Missing structured proof remains inconclusive; generation never writes owner judgment.
- A3: Generation rejects disabled, unrelated, unreadable or missing capture. Provenance distinguishes criteria recorded by the agent from criteria copied from the captured request. Existing imported evaluations remain readable.
- A4: Astack's substantive routes automatically use the durable handoff, keep one task across follow-ups, and report unavailable capture without blocking delivery.

The button uses the captured request as its acceptance criterion; it does not need another model service. Agents supply specific acceptance and skill criteria. Selection is explicit: agent start/end turn boundaries or one UI-selected turn, never all historical work in a conversation.

Pen is skipped because the backup uses the existing run-detail button and evaluation layout without a new visual direction. Storybook is selected for pending, unavailable and failure/retry states and generation provenance. Native Convex checks and an anonymous local browser journey cover real authorization, persistence and navigation. Domain/SQLite checks cover capture lag, scope and restart. Installed-host skill activation and Otis deployment are separate from this repository change.

## Observed acceptance

| Case | Result |
| --- | --- |
| A1 | Pass: SQLite restart/capture-lag tests and the real begin/finish CLI → queue → HTTP → fresh owner read. A running or interrupted turn without a completion timestamp stays pending. One supplied, actually executed saved-edit report passes without creating owner grades. |
| A2 | Pass: real local UI create/reload/retry returns the same persisted review; the button opens the existing agent evaluation. Missing proof says checks incomplete. Narrow layout has no horizontal page overflow. |
| A3 | Pass: native function tests reject anonymous/foreign identities, wrong project, disabled enrollment and unreadable capture. Existing imported fixtures still load. Provenance retains the exact request and source revisions. |
| A4 | Repository instructions pass integrity checks. Native Codex implicit identity lookup succeeded against this host in disposable private state. Installed-host refresh and Otis activation were not performed. |

See [verification](evidence/verification.json) for commands, environment and tested source hashes. Selected synthetic captures show the [run button](evidence/run-generation.png), [backup review](evidence/capture-generated-review.png) and [agent review](evidence/agent-generated-review.png). Raw runner directories remain ignored.

Convex reviewer self-review found no blocking findings: the mutation requires owner identity before database reads, rechecks current project capture policy, uses bounded indexed reads and explicit argument/return validators, and saves through the existing snapshot boundary in one transaction. Concurrent retries are covered. No independent reviewer was used.
