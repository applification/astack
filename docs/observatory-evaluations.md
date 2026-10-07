# Observatory evaluations

Evaluations connect the request, acceptance cases, declared skill criteria, captured turns and structured verification reports. Owner assessments separately judge intent, skill application/output and outcome. Agent completion does not assign an assessed outcome.

## Evaluate captured work

Preserve the original request and acceptance cases at task start, with actual authorized clarifications. Build a versioned JSON manifest following the [authoritative schema](../packages/agent-observability/src/evaluations.ts). Its UUID, enrolled project, captured run IDs, creation time, title, intent, criteria version, cases, skill criteria and proof are explicit. One evaluation can reference several turns from the same project/computer. An optional `intent.source` contains `runId` and `eventId`; it must identify a captured user prompt whose redacted content exactly matches the request. Without it the request is visibly labelled declared.

Drive the relevant user path with the project's existing control CLI/runner. Produce a proof report from actual assertions and observations: full Git revision, dirty state, source digest, target, actor, fixture, command and case attempts. Each attempt records status, observation, any required independent observation and retained artifact paths/SHA-256 digests. Preserve failures and artifact bytes through cleanup. Observatory saves references, not artifact bytes, and does not independently authenticate supplied reports.

```sh
agentlog evaluation check --file evaluation.json
agentlog evaluation import --file evaluation.json
```

Check prints per-case verification interpretations; exit zero means a valid manifest, not a successful product outcome. Import namespaces the UUID with the configured computer identity and uses the private SQLite queue, configured credential redaction and capture policy. Linked turns and the original prompt upload before their evaluation. Identical retries are idempotent; revised intent, criteria or proof requires a fresh evaluation UUID. Offline forwarding retries independently of agent work.

Open **Evaluations** in Observatory. Original intent leads into the agent's reported result and a chronological timeline of the linked turns. Each step uses readable activity headings and bounded captured request/response excerpts, with full trace links, skill activity and capture details inside it. Excerpts come from the current enrolled capture; the original request and run snapshots remain preserved with the evaluation. Missing excerpts have an explicit fallback. A completed turn does not establish engineering success.

Expand **what was checked?** to compare expected behavior with actual observations. Attempts, first failures, proof context and artifact references remain available one level deeper. Answer **Did this deliver what you wanted?** with Yes, Partly, No or Not sure yet, and optionally comment. This feedback is saved independently of technical grades and survives reload. It can express a useful result even while a check still fails; the check status stays visible. Immutable history retains the latest 20 reviews, and identical request retries are idempotent.

Use **Detailed intent and skill review** when a criterion-level assessment is useful. The owner assesses intent, every declared skill criterion and outcome with reasons and case/trace evidence. Missing or unrelated trace IDs are rejected. Assessments retain cited trace snapshots and immutable history; the view shows the latest 20. Several appropriate skill routes can satisfy a task. Skill reads alone never establish application. Simple outcome feedback never creates detailed grades.

All declared cases are material in this first schema. Missing cases, skipped/setup-inconclusive attempts, missing required independent observations and absent retained artifacts remain inconclusive. Retry passes retain the first failure and are flagged flaky. Passing assessed outcomes require sufficient reported proof plus owner review; process grades remain independent. Criteria and evaluator versions (`proof-v1`, `human-v1`) stay visible.

## Astack route and workflow evidence

**Path taken** shows one connected map from astack through the explicitly selected route and the path the agent reported. The main rail sits centrally under astack; child lanes alternate to its left and right, with labels facing outward. The map stays expanded, and child lanes return only at a declared parent join. Wider journeys open centered on the main rail and scroll horizontally. Phase transitions can span the evaluation's linked turns. Failed attempts, retries, omission reasons and changes of route remain visible. Select a phase's skill badge to inspect its declarations and supporting trace event links; observed child skills link directly to their owning trace events. Declarations do not prove application or delivery. Current-capture references are distinct from the preserved original request and immutable assessment snapshots.

Use the [agent recording instructions](../skills/astack/references/observatory.md#record-the-route-and-path) at route selection and meaningful transitions. Flow IDs belong to capture; external work identities remain owned by their original dispatcher. Record an initial choice before work where possible; a late declaration keeps its actual timestamp and does not retroactively establish a task-start decision. Existing unstructured workflow calls and skill reads are retained, but older captures say **Flow not recorded** rather than infer a route.

The first selected plans support bug-fix and new-feature (`implement`) delivery; the other astack route IDs are also accepted. Plans may change. Workflow previews are bounded to 64 records per turn, 80 overall and 256 KiB, with at most 32 supporting event previews. Missing references, missing selection and display limits stay visible. Evidence is resolved only in linked turns within the currently enabled readable project/machine capture.

In **Detailed intent and skill review**, optionally select **Include a flow assessment**. Judge **Route choice** and **Flow execution** independently, with a reason and captured trace evidence for both; route judgment must cite a recorded selection or change. Owner-only writes retain the cited event/annotation revisions. Flow grades do not assign outcome feedback, change proof results or certify skill application automatically.

Upgrade the backend before the collector to use structured workflow annotations. The additive event field and optional indexed projection need no historical backfill. Existing evaluations and assessments remain readable; installing the updated astack instructions in an agent host is separate from deploying Observatory's runtime.

## Disposable saved-edit proof

```sh
bun packages/agentlog/src/cli.ts evaluation demo-proof --variant defective --output .proof/evaluations
bun packages/agentlog/src/cli.ts evaluation demo-proof --variant fixed --output .proof/evaluations
bun packages/agentlog/src/cli.ts evaluation demo-proof --variant unavailable --output .proof/evaluations
```

Run this demo through the Bun source CLI in an astack checkout; it reads the fixture source, evaluation rules and lockfile to identify the executed proof. Evaluation check/import work independently of this repository fixture. Each invocation owns an ephemeral loopback service and document. It saves through HTTP, reopens through a fresh request and independently reads disk. Defective acknowledges a save without persisting; fixed persists; unavailable returns 503. Observations and `proof.json` survive cleanup in unique directories. The service and scratch document are removed. This exercises a real service fixture, not an autonomous coding-agent trial.

## Local integration proof

Start an anonymous local Convex deployment from `packages/backend` using `CONVEX_AGENT_MODE=anonymous bun x convex dev --typecheck disable`. Initial auth configuration requires `OBSERVATORY_AUTH_ISSUER` set to the generated local site URL and `OBSERVATORY_JWKS_URI` set to the shell-quoted value `data:application/json;base64,eyJrZXlzIjpbXX0=` through `convex env set`. Keep that owned development process running. Then, from the checkout:

```sh
bun packages/backend/scripts/verify-evaluations-local.ts
VITE_CONVEX_URL=http://127.0.0.1:3210 VITE_CONVEX_SITE_URL=http://127.0.0.1:3211 bun run --cwd apps/observatory dev --port 7410 --strictPort
E2E_TELEMETRY_DISABLED=1 bun x e2e run --config e2e.evaluations-local.config.ts
```

Use the actual generated backend/site URLs if they differ. The script rejects hosted/non-anonymous targets before replacing local auth with disposable keys. It generates all three reports, seeds explicitly synthetic turns, imports through SQLite/HTTP, authenticates the owner and confirms persisted assessments with fresh reads and anonymous denial. Results stay ignored in `.proof/observatory-evals/local`. The URL-only browser config leaves operator-owned processes running; stop those owned commands afterward. Production builds still require HTTPS; loopback HTTP is development-only. Retained screenshots use synthetic stories because authenticated e2e secret policy can prohibit captures.

## Rollout and limits

Route journeys add explicit delegated child identities, observed child skill reads and parent joins. Native Codex turns retain the first collector's canonical run and event set; T3 supplements task lifecycle and conversation aliases. Native coordination tool completion is not a child outcome. Fork lineage alone does not establish delegation, and child completion or result delivery never creates a join.

The journey reads current enabled, enrolled, readable capture on the same machine/project. It shows up to 32 direct delegations, 20 child turns, 80 total workflow records and 32 skill reads/evidence previews within a shared 256 KiB read budget. Repeated identities, missing capture, nested delegations and display limits remain explicit. Evaluation intent, linked-run snapshots and assessment evidence eligibility are unchanged. Precise skill caller instrumentation and automatic nested expansion are outside this slice.

Upgrade the backend before the collector/UI. New ingestion maintains the indexed conversation aliases; the existing bounded `ingestion:rebuildFacets` repair also projects legacy native session identities. T3 capture version 3 replays its matched active/archive metadata to add aliases and task facts. Old captures lacking relationships remain unavailable rather than receiving inferred parentage.

Upgrade the backend before enabling evaluation imports. The schema-v1 envelope additionally accepts `evaluation` records; older backends reject them and older collector binaries cannot read those queue records. Retain the upgraded collector for replay. Existing run/event records retain their shape and outcomes.

At the owner's request, revision `37a3c0c` was deployed to Otis on 2026-10-06, with backend functions first and then the production UI/signed collector. Recovery copies and a private database export were retained. Signed CLI check/import, live evaluation auth/scope/snapshot checks and six authenticated browser journeys pass; served HTML/JavaScript match the build and source/forwarding health is good. See [deployment proof](../.astack/observatory-evals/evidence/otis-deployment.json).

The follow-up at `bb4061e` simplifies the detail page with a work timeline, expandable expected/observed checks and outcome feedback. [Review-flow proof](../.astack/observatory-evals/evidence/ux-review.json) records permitted/denied feedback operations, local save/reload, component states and six deployed browser journeys. The backend was upgraded before the UI; served HTML, JS and CSS match the build. Existing evaluations need no migration. Full component CI passed after the screenshot-helper type correction; this correction does not change the deployed product.

Open [Evaluations on Otis](https://otis.tail12a0a0.ts.net:8450/#evaluations) and select **Observatory evaluations — first implementation**. This review item uses the three actual captured planning/implementation turns, the original prompt and the retained first-delivery proof. Its report is explicitly assembled from earlier local observations and preserves their source identities; it does not claim a new agent trial or independent certificate. Evidence bytes are also retained in the private runtime's `reviews/observatory-evals-first-implementation` directory. Deployment added no owner judgment: use the outcome review for your view of the result, or expand the detailed review to assess intent, the declared implementation/verification skill criteria and outcome.

The first workflow uses explicit manifests and human assessments, with bounded metadata/trace snapshots. Artifact hosting, automatic task-start/verification handoffs, semantic model judges, controlled agent execution and skill-version comparisons follow later. Synthetic assessments cannot prove real agent skill application or causal improvements.

Revision `ff26d80` adds structured astack route/phase recording and was deployed to Otis with the backend upgraded first. [Flow proof](../.astack/observatory-flows/behavior-contract.md) retains verification, recovery and served-asset observations. Open **Observatory — astack route and workflow tracking** in Evaluations for the two actual intent/implementation turns and the flow explicitly declared during this change. Its original timestamps distinguish late recording from task-start selection. The reported contract checks and captured actions support owner review; deployment creates no owner judgment. Historical evaluations keep their recorded skill activity and show missing structured flow explicitly.

At the owner's request, revision `4e7b870975c569688594ebdbb39edd0a7446eb1f` was deployed on 2026-10-07 for route journey review. The backend was upgraded first, 1,376 existing runs received indexed conversation projections, and the signed collector/UI were updated. Seven live browser checks pass; deployed queries and authenticated browser inspection resolve the two actual children, their distinct skill reads and both parent join references. Open **Observatory — route journeys and subagents · delivered feature** in Evaluations. Its three feature turns and supplied verification observations are an immutable snapshot; workflow declarations were recorded after delivery, and owner judgment remains pending. [Deployment evidence](../.astack/observatory-journeys/evidence/otis-deployment.json) retains sanitized observations. Private recovery copies and a database export are retained on Otis.

The owner-directed UI revision `3f74b17b67d61692591ce6207f23974080d6aff6` replaces the duplicate journey/sequence views and flow-wide skill strip with one connected, always-expanded map. It was deployed to Otis on 2026-10-07. All 36 Storybook browser checks and seven live checks pass; authenticated inspection confirms measured line endpoints, two open child lanes, child-owned trace navigation and horizontal scrolling without page overflow. [Connected-map evidence](../.astack/observatory-journeys/evidence/connected-map-deployment.json) records the served hashes and selected synthetic captures. The prior UI is retained for recovery.

Revision `83b76c979c7e1ed54dc6616e1e92d6ddf10cd4a6` centers the main rail under astack and distributes child lanes on both sides. The first child uses indigo, descriptions use smaller type, and long revision values become compact badges that copy the full value. It was deployed to Otis on 2026-10-07. All 38 component/browser checks and seven live checks pass, covering zero through four children, outward labels, connected geometry after viewport resizing, manual panning while evidence opens and revision copying/failure recovery. [Centered-map deployment evidence](../.astack/observatory-journeys/evidence/centered-map-deployment.json) records runtime hashes, browser observations and selected synthetic captures.

Revision `474e198110e58d6b25589d1b6264b705d3c05a33` keeps the copy icon and badge dimensions unchanged, with success feedback in a brief toast. The delegated-work label and count sit in a compact card centered above the split. It was deployed to Otis on 2026-10-07. All 38 browser checks and seven live checks pass; native copying in the actual review succeeds without changing the badge. [Copy-toast deployment evidence](../.astack/observatory-journeys/evidence/copy-toast-deployment.json) records before/after rendering, card placement, served hashes and synthetic screenshots.

Revision `63225edff47b7c1aa8084b94400be46d5542fc1e` gives the original request a prompt card, preserving its exact text, paragraph breaks, trace link and agreed scope. A neutral line connects it to astack and follows map panning, scope expansion and resizing. The label remains explicit when the request has no captured source. This UI-only revision was deployed to Otis on 2026-10-07; all 39 browser checks and seven live checks pass. [Prompt-origin deployment evidence](../.astack/observatory-journeys/evidence/prompt-origin-deployment.json) retains geometry observations, served hashes and synthetic screenshots.

### PR delivery evidence

The PR skill can record an existing task PR against a readable evaluation parent run:

```sh
agentlog delivery capture --run <captured-parent-run-id> --pr https://github.com/<owner>/<repo>/pull/<number>
agentlog delivery refresh --event <returned-event-id>
```

Capture uses the machine's existing `gh` access and enforces the run's enrolled project, readable-capture and repository policy. It saves a bounded PR summary, up to 50 checks and four image references. Supported public PNG/JPEG/WebP repository assets at full commit SHAs render inline with a full-image link and captured digest; private, mutable, unavailable and unsupported images remain links. Credentials and arbitrary PR HTML are never sent to the browser. Existing records need no migration.

The bottom result card combines that delivery snapshot with reported evaluation verification. Captured checks/media keep their revisions. Refresh updates only the separately timestamped latest PR observation; it never upgrades verification, changes the captured PR snapshot or assigns an owner grade. A new PR head can be captured as a new delivery record. The record must belong to a parent run already included in the evaluation. A PR skill read or a host's linked-PR metadata alone is not a delivery record.
