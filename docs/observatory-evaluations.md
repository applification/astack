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

Upgrade the backend before enabling evaluation imports. The schema-v1 envelope additionally accepts `evaluation` records; older backends reject them and older collector binaries cannot read those queue records. Retain the upgraded collector for replay. Existing run/event records retain their shape and outcomes.

At the owner's request, revision `37a3c0c` was deployed to Otis on 2026-10-06, with backend functions first and then the production UI/signed collector. Recovery copies and a private database export were retained. Signed CLI check/import, live evaluation auth/scope/snapshot checks and six authenticated browser journeys pass; served HTML/JavaScript match the build and source/forwarding health is good. See [deployment proof](../.astack/observatory-evals/evidence/otis-deployment.json).

The follow-up at `bb4061e` simplifies the detail page with a work timeline, expandable expected/observed checks and outcome feedback. [Review-flow proof](../.astack/observatory-evals/evidence/ux-review.json) records permitted/denied feedback operations, local save/reload, component states and six deployed browser journeys. The backend was upgraded before the UI; served HTML, JS and CSS match the build. Existing evaluations need no migration. Full component CI passed after the screenshot-helper type correction; this correction does not change the deployed product.

Open [Evaluations on Otis](https://otis.tail12a0a0.ts.net:8450/#evaluations) and select **Observatory evaluations — first implementation**. This review item uses the three actual captured planning/implementation turns, the original prompt and the retained first-delivery proof. Its report is explicitly assembled from earlier local observations and preserves their source identities; it does not claim a new agent trial or independent certificate. Evidence bytes are also retained in the private runtime's `reviews/observatory-evals-first-implementation` directory. Deployment added no owner judgment: use the outcome review for your view of the result, or expand the detailed review to assess intent, the declared implementation/verification skill criteria and outcome.

The first workflow uses explicit manifests and human assessments, with bounded metadata/trace snapshots. Artifact hosting, automatic task-start/verification handoffs, semantic model judges, controlled agent execution and skill-version comparisons follow later. Synthetic assessments cannot prove real agent skill application or causal improvements.
