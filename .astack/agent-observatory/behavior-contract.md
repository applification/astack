# Agent Observatory v1

Owner: requesting user. Private companion capability in astack, requested 2026-10-05.

Observe how coding agents accomplish engineering work, then use the evidence to improve skills, workflows and instructions. Codex desktop is the primary surface; CLI and T3 Code must be observed without a required launch wrapper. No COS or current durable Astack work model exists. Work is an optional external reference, never a competing task tracker.

## Acceptance

- CAPTURE: Read persisted turns from every configured Codex home and source kind (active and archived), without starting/resuming/interrupting agent turns. Deduplicate replay and preserve updates. Show capture coverage and unavailable facts.
- PORTABLE: A compiled agentlog can run independently of the UI/backend source. Adapter translation does not put Codex types into the core domain.
- PRIVACY: Redact before every local persistence/network boundary. Default to metadata; prompts, outputs, code, MCP arguments/results are withheld. Never enumerate environment values into telemetry. V1 rejects raw content capture; metadata redaction is enforced. Credentials stay in permission-restricted local files.
- OFFLINE: Killing the collector or losing connectivity retains its queue and checkpoints. Restart and replay deliver each logical record once; telemetry faults never change agent execution.
- PRIVATE: Persistent Convex on Otis, loopback-only Docker bindings, HTTPS through Tailscale Serve, no Funnel/public exposure. Machine credentials cannot read data or impersonate another machine. Native Convex JWT authentication protects every UI query.
- LINKS: Runs without work are useful. Trusted launch context/session binding supplies work/project IDs automatically when available. Work view groups external references and supports safe source links without creating work records.
- TRACE: Runs filter by repo/project/work/agent/version/machine/branch/status/skill/tool/date. Expand events in native order; expose failures, edits, skills and interventions. Distinguish observed timestamps from unknown item times.
- FEEDBACK: Deterministic repeat-failure/test/MCP/intervention/long/idle rules retain supporting event IDs. Skill/instruction hashes have capture provenance; correlations are descriptive, not causal claims. Workflow events are explicit context, not invented from conversation.
- PROOF: Typecheck, meaningful queue/redaction/adapter/analysis/auth/ingestion checks, real self-hosted push and permitted/denied operations, running UI navigation and screenshot evidence, collector observing a real desktop session.

## Design decisions before implementation

Pen selected for initial runs/trace layout and visual tokens. Storybook selected for expandable trace, empty, privacy, missing-time and failure states. React/Vite, Bun workspaces, shared browser-safe presentation and Convex match the foundation conventions. Persistent backend is deliberately separate from the examples and static public site. Tailscale is the private deployment boundary chosen by the owner.

## Capture semantics

A session contains turns; a turn is an execution attempt/run. Session identity and optional parent session remain available. Completion means the agent turn ended, not that engineering work succeeded. Item order from persisted history is authoritative; precise item timestamps are unavailable there. Hooks can augment times/context but need native trust review. Ephemeral/cloud-only/unpersisted runs cannot be recovered from a machine's local thread store.

## Observed decisions and limits

The initial Pen exploration did not save a .pen artifact: its connection references a removed foundation checkout. The required design comparison is unavailable and is named in the draft PR. Storybook and actual private UI behavior were exercised separately. MacBook installation is intentionally an owner action for later; only Otis is installed now. See [evidence](evidence.md) for results and scope.

## Astack appearance refinement, 2026-10-05

Owner-selected visual reference: [the live Astack site](https://astack.applification.net). Before implementation, inspected its actual light/dark rendering and palette: slate paper, blue links, Newsreader headings, Geist body text, IBM Plex Mono labels, thin dividers, pill controls and a compact top navigation. Reuse those roles at dashboard scale, including the sign-in screen. Fonts are bundled locally.

- APPEARANCE: Runs, Work, Skills, Problems, health and expandable traces share the selected typography and light/dark roles; warning/success states remain distinct. Desktop and narrow views retain reachable navigation and no document overflow.
- THEME: Offer System, Light and Dark before and after sign-in. System follows live OS changes; an explicit preference survives page reload. Persist only that preference, never access keys/JWTs. Theme control remains keyboard accessible.

Storybook is selected for isolated light/dark fixture captures and theme interactions, plus a deployed UI check. The owner’s rendered site supplies the visual direction for this refinement; the already unavailable Pen connection is not retried. No Pen artifact/comparison is claimed. Record actual reference-to-browser comparison separately from that original gap.
