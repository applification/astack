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

F1–F5 pass on product revision `ff26d8036575440a5de81e4da2e469e2f3098042`. [Verification observations](evidence/verification.json) retain the source digest and per-file hashes: 97 domain/collector/native tests, 31 component browser checks and three authenticated persisted local browser journeys pass. Native checks exercise restart, cross-turn recording, project/readable-capture boundaries, annotation snapshots and owner-only grading; the local browser persists and reloads a flow assessment and follows its annotation into the real trace. [Bug-fix path pixels](evidence/astack-bug-fix-path.png) use synthetic fixtures.

[Otis deployment proof](evidence/deployment.json) records the backend-first runtime rollout, fresh actual-flow reads, served asset equivalence, seven authenticated browser journeys and CI success. An early queue promotion reached the old collector before the upgrade completed; forwarding was paused, both versions upgraded and capture/forwarding recovered with pending zero. No telemetry or original timestamps were discarded. Recovery copies and a database export remain in the private runtime.

Three first browser probes failed because selectors matched repeated text inside closed disclosures; scoped selectors resolved them. A same-millisecond ordering regression initially failed strict type narrowing; its discriminant-aware assertion now passes. These were test failures, retained separately from product observations. The final selected browser runs have no failures or retries. Convex/React/TypeScript self-review has no unresolved finding.

The new Otis evaluation uses the two actual intent/implementation turns and this task's explicitly recorded flow. Its annotations began after capture scaffolding was available, retain their actual recording times, and make no retrospective task-start claim. Owner feedback and detailed grades were not written by deployment. Updated source skills and project guidance support future recording; the installed global plugin cache was not changed.
