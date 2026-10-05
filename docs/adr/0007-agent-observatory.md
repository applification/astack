# 0007: Private agent observability with external work references

Date: 2026-10-05. Status: accepted. Scope: Agent Observatory v1.

## Context

The owner requests a private feedback loop for all coding-agent runs, primarily Codex desktop, with persistent Convex on Otis and machine ingestion over Tailscale. Astack currently distributes engineering skills and references; its durable work/orchestration owner is an external COS. StoryLoop is archived and no replacement is installed.

## Decision

Keep the companion UI, domain, backend and portable collector in this repository. External work identity is optional parent context; no example work-item CRUD becomes a task system. A run is a bounded attempt, mapped by the Codex adapter to a persisted turn and retaining its session. Agent completion is distinct from engineering outcome.

Prefer passive supported app-server history for automatic desktop/CLI/T3 capture. Do not parse unstable transcripts or require a launch wrapper. Optional asynchronous trusted hooks augment metadata without altering execution. The domain and durable envelope are agent neutral; Codex protocol translation stays in its adapter.

V1 captures metadata only and redacts before local buffering. SQLite revisions/acknowledgements survive restart and offline replay; remote ingestion is idempotent. Private machine credentials authorize only their machine. Owner UI queries use native Convex verification of short-lived RS256 JWTs with an opaque UUID subject; Tailscale identity or a separate owner key authorizes minting.

Self-host Convex with a persistent volume and loopback bindings on Otis. Tailscale Serve provides private HTTPS. Use bounded, indexed projections and descriptive capability-version correlations rather than AI analysis or causal claims.

## Consequences

The system observes ordinary persisted runs without needing the future COS. A launcher can automatically bind its externally owned identity when receiving the agent session ID. Metadata privacy limits explanation of prompt/output content, and current persisted APIs lack item timestamps and token counts. Skill hashes distinguish observation-time from hook-time snapshots; historical versions cannot be invented. Ephemeral/cloud capture and Claude adapters require additional supported sources later.

Validation and deployment status are recorded separately in the feature evidence, not implied by this decision.
