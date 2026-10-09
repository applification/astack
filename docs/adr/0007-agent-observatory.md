# 0007: Private agent observability with external work references

Date: 2026-10-05. Status: accepted. Scope: Agent Observatory v1.

## Context

The owner requests a private feedback loop for all coding-agent runs, primarily Codex desktop, with persistent Convex on Otis and machine ingestion over Tailscale. Astack currently distributes engineering skills and references; its durable work/orchestration owner is an external COS. StoryLoop is archived and no replacement is installed.

## Decision

Keep the companion UI, domain, backend and portable collector in this repository. External work identity is optional parent context; no example work-item CRUD becomes a task system. A run is a bounded attempt, mapped by the Codex adapter to a persisted turn and retaining its session. Agent completion is distinct from engineering outcome.

Prefer passive supported app-server history for automatic desktop/CLI/T3 capture. Do not parse unstable transcripts or require a launch wrapper. Optional asynchronous trusted hooks augment metadata without altering execution. The domain and durable envelope are agent neutral; Codex protocol translation stays in its adapter.

V1 redacts before local buffering. Following the owner's 2026-10-06 request, new collectors capture readable visible messages and tool content by default; existing explicit metadata-only configurations keep that setting. The trace has a separate Show content display preference. Secret redaction remains mandatory. SQLite revisions/acknowledgements survive restart and offline replay; remote ingestion is idempotent. Private machine credentials authorize only their machine. Owner UI queries use native Convex verification of short-lived RS256 JWTs with an opaque UUID subject; Tailscale identity or a separate owner key authorizes minting.

Self-host Convex with a persistent volume and loopback bindings on Otis. Tailscale Serve provides private HTTPS. Use bounded, indexed projections and descriptive capability-version correlations rather than AI analysis or causal claims.

### Project capture amendment, 2026-10-06

The owner narrowed capture from system-wide history to explicitly enrolled projects, while retaining a shared private service across machines. Store each project's stable identity and repository/folder matching policy centrally. Resolve thread metadata before reading full turns and independently enforce enabled membership during ingestion. Repository identity covers clones/worktrees across machines; explicit folder roots belong to one machine. Conflicting matches fail closed. External work references remain optional and cannot override project classification.

Keep previously retained unmatched history for recovery, outside enrolled reports and forwarding, rather than deleting it during this scope change. Assign only reliable metadata matches in bounded, repeatable passes. Pausing a project preserves its existing reports and immediately denies future ingestion. Offline collectors retain the last accepted policy, so local pause enforcement waits for reconnection; fresh collectors without a policy capture nothing.

### T3 provider capture amendment, 2026-10-06

Add a separate optional T3 history reader alongside the native Codex reader. T3's protocol-v2 projection is a shared source for Claude, Codex and other providers; provider-specific translation belongs inside that adapter. A T3 orchestration run can span multiple provider turns, so Observatory maps one provider turn to one run and retains T3's enclosing identities as trace metadata. Non-Codex identities include the environment and provider instance. T3 sessions use the environment and app-thread identity; Codex retains its native session/turn identities.

The same Codex turn can be visible through both sources. Prefer its existing canonical run ID and retain the first collector's complete event set rather than merging incompatible item identities. Existing native history and its annotations remain intact. Native capture is polled first, but a T3-owned Codex turn stays T3-owned on subsequent polls. The second source cannot add ordinary trace events to the first source's coverage; the narrowly scoped result-observation exception below supplements host facts. Missing or weak native Codex identities defer capture instead of creating provisional duplicate runs, and deferred threads are retried with a visible partial-health count.

Authenticate with an owner-issued read grant, pin the environment identity and protocol before sending bearer credentials, and keep credentials in restricted local files. T3 sources run on the computer that owns their workspace paths so existing project enrollment and local Git matching apply. T3 history is observed through supported HTTP reads and two read-only RPC methods; no direct T3 database collector, execution changes or provider-control commands are introduced.

### Delegated result observation amendment, 2026-10-08

Permit strict, separately identified parent observations of delegated result
presence, explicit host delivery and explicit terminal-result acknowledgement
alongside a native-owned trace. Match the approved parent's host, task and child
identities before retaining them. These observations cannot replace canonical
events, alter canonical event counts or findings, or enlarge immutable evaluation evidence.
Keep their first observation time separate from host update time; missing
occurrence time stays unknown. Passive capture cannot recover missed states.

A child conversation remains separate. Task completion does not establish
receipt, and receipt does not establish parent integration: the latter needs an
explicit workflow join. A missing child trace is a coverage gap and does not
invalidate a correctly scoped fact captured in the approved parent. Known child
access restrictions continue to block the result projection, and no child
content is fetched through this exception. Current work views use bounded
direct-child capture while frozen evaluation evidence remains unchanged.

## Consequences

The system observes ordinary persisted runs without needing the future COS. A launcher can automatically bind its externally owned identity when receiving the agent session ID. Readable capture supports diagnosis of failures; hiding content is a screen preference and does not erase private stored data. Metadata-only capture remains available. Native Codex persisted items lack individual timestamps; T3-recorded times are identified separately, and unavailable token counts remain unknown. Skill hashes distinguish observation-time from hook-time snapshots; historical versions cannot be invented. Claude capture through T3 covers T3-recorded observations; standalone Claude and ephemeral/cloud capture require additional supported sources.

Validation and deployment status are recorded separately in the feature evidence, not implied by this decision.
