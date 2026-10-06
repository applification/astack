# Astack routes and workflow evidence

An owner can see which engineering route the agent selected for a request, why it selected it, and how its phases and skill use contributed to the result across captured turns. Declarations remain distinct from observed actions and owner judgments.

## Acceptance

- F1: `agentlog workflow` records a selected route and reason, phase transitions, declared skills and explicit trace references. Flow identity survives collector restart and later turns. Disabled or unrelated project capture rejects recording; telemetry failure never blocks delivery.
- F2: Evaluation detail shows route, reason, planned phases and the chronological actual path. Repeated attempts, failed phases, justified omissions and route changes remain visible. Legacy captures display missing structured flow without inventing a route.
- F3: Linked evidence is resolved only within the evaluation's currently enabled project/machine and linked turns. Missing references and bounded/truncated capture stay explicit. Skill reads and phase completion never imply successful application or outcome.
- F4: Optional owner route and execution judgments cite captured evidence and retain immutable snapshots. Existing assessments and outcome feedback remain compatible and independent.
- F5: Bug-fix and new-feature flows render clearly on desktop and narrow screens; expanded evidence opens the corresponding trace event. Instructions explain recording at route selection and meaningful transitions, including changed plans.

## Design and verification

Pen is skipped: the owner approved the focused flow concept in this thread, and production uses the existing evaluation disclosure/timeline design. Storybook is selected for recorded, changed, missing, failed/retried and narrow-screen states. Domain/collector and native Convex checks cover validation, restart, evidence scoping and owner-only persistence. Browser checks cover presentation and interaction; a real local backend push and Otis rollout cover the deployed adapter. Retained screenshots use synthetic fixtures.

No rigid mandatory sequence or automatic semantic judge is introduced. The agent selects a route based on the prompt and may revise it with a reason. This records visible decisions and actions, not private reasoning. Workflow identity is capture metadata, not an external work identity. Capture remains optional.

## Proof

Pending implementation and verification.
