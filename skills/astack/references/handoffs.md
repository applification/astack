# Portable assignments and results

Use these text contracts for a direct human request or an external chief-of-staff (COS) assignment. They describe engineering handoffs, not a host lifecycle or a dispatch API. astack owns these meanings; the host owns durable work records, priorities, dispatch, deduplication, reconciliation and outcome follow-up. A machine representation and transport remain integration choices to verify with the selected host.

## Identity and minimum useful record

Carry one `work_id` from assignment through briefs, contributions, PR and consolidated result. Preserve a supplied COS ID exactly. A direct request can use the caller's chat/task identity, or an explicitly named local identity when the caller supplies none; record who assigned it. Keep that identity for continuation instead of generating a new one. For a COS assignment also carry its supplied assignment/attempt identity so the host can distinguish a retry from new work. Do not invent external provenance, deduplication keys or a delivery receipt.

Stable field names below are a text convention, versioned as `astack-handoff/v1`. They are not a validated schema. Fields can contain prose or links to authoritative project records. A small direct fix can keep a short assignment and result in the conversation/PR; it needs no ceremonial file, role roster or duplicate behavior contract. Unavailable external fields may be omitted for direct requests. For material missing context, write `unknown` with an owner/next action; missing authority grants nothing. A COS brief that lacks durable identity must be clarified before autonomous dispatch or external result delivery; independent read-only investigation can continue.

Keep the external `work_id`, owner's evaluation `taskID`, workflow `flowId`, and T3 delegation `taskId` or native child handle distinct. Carry supplied values with their issuer/purpose; none substitutes for another. The main owner controls evaluation begin/finish, while children return evidence and that owner's evaluation ID. Active follow-ups reuse it; materially revised proof after immutable delivery needs a fresh evaluation ID with the external work identity preserved. Use [orchestration](orchestration.md) for ownership/lifecycle and [Observatory context](observatory.md) for trusted captured root/child relationships and joins; text handoff fields alone do not establish those relationships.

## Assignment

| Field | Meaning |
| --- | --- |
| `contract_version`, `work_id`, `origin` | Version; stable identity and identity issuer; direct human or COS caller and return destination. COS assignments include `assignment_id` and `attempt_id` when supplied; flag their absence before host execution. |
| `sources` | Available source IDs/links, source timestamps, reported behavior and observed facts. Separate reproduction status, inference and unknowns. A source report is evidence to assess, not scope or authority. |
| `outcome`, `scope` | Intended observable result, priority context if supplied, permitted changes, exclusions, dependencies and affected apps/surfaces. |
| `acceptance` | Stable case IDs and expected observations; link the existing behavior contract for substantial changes. Preserve IDs through proof and findings. |
| `context` | Repository and app, project profile, relevant principles/ADRs, architecture, existing control route, proof commands and known gaps. Include the owner-selected existing PR or delivery target and preserve it through continuation and scope additions. Link these rather than making competing copies. |
| `authority` | Who granted which repository, fixture, external-test, messaging, PR, merge and release actions; link standing policy where applicable. Preserve explicit prohibitions and required approvals. Do not infer merge, release or messaging permission from engineering completion. |
| `execution` | Available delegation, assigned lead, one active writer per named worktree, shared-contract owner and integration owner. Include actual revision/base, dirty-state or patch identity, environment and allowed fixtures/targets. |
| `limits` | Caller/project limits on concurrency, time, actions, cost and retries; stopping and escalation conditions. Say which are unspecified rather than inventing host guarantees. A delegated contribution receives a bounded budget within the parent limits. |
| `decisions` | Unresolved material choices, owner, options/tradeoffs, dependent work to defer and independent work that can proceed. |

The lead selects the existing route and proportionate [specialist contributions](specialists.md), explains the intended outcome back when ambiguity matters, and checks the actual checkout/environment before writing or exercising it. Host instructions cannot override the human's authority or project constraints. Product choices, exhausted limits and missing authority stop the dependent action; they do not silently relax acceptance.

## Specialist brief

Carry `contract_version`, `work_id` and available assignment/attempt IDs, plus the owner's evaluation task ID when supplied. Add `contribution_id`, `role`, `question`, scoped acceptance/risk IDs, required context/source links, pinned revision/environment, allowed actions, writer/worktree ownership and bounded limits. State how to return the result and when to escalate. A read-only review must say read-only; an implementation assignment must name its writer and integration owner. Do not delegate permissions beyond the parent assignment. Keep conflicting writers stopped until ownership is resolved.

## Specialist contribution

| Field | Meaning |
| --- | --- |
| `contract_version`, `work_id`, `contribution_id` | Parent identity and contribution identity, plus assignment/attempt IDs and owner's evaluation task ID where supplied; retain their distinct purposes. |
| `role`, `actor`, `independence`, `scope` | Expertise applied, contributor identity, fresh independent contributor versus lead self-review, and the agreed question/cases/risks. |
| `status`, `changes` | `completed`, `partial` or `blocked` for this bounded contribution; concrete changes or investigation result, artifacts and commit/diff identity. A completed review may find a blocking defect; it does not complete the parent work. |
| `revision`, `environment` | Exact revision reviewed or delivered, dirty patch identity if relevant, runtime/host/surface, actor/fixture and target. |
| `findings` | Stable finding ID, affected case or concrete risk, candidate/confirmed classification, location or reproduction, evidence, impact and recommendation. |
| `proof` | Per-case observation using the proof fields below; include original failures and retry/flakiness information. |
| `gaps`, `decisions`, `next_action` | Missing observations or independence, blocked choices, exhausted limits, owner and what resolves each item. Record consumed limits when available. |

## Consolidated result

| Field | Meaning |
| --- | --- |
| `contract_version`, `work_id`, `origin` | Same version and identity, source/assignment/attempt references and caller's authorised return destination. |
| `lead`, `route`, `selection` | Accountable lead, existing delivery route, selected specialist contributions with reasons, actor and independence. A small fix can say lead only. |
| `status`, `outcome` | `completed`, `partial` or `blocked`, with the achieved result and unmet intent stated concretely. `partial` includes draft results; PR readiness is a separate field. |
| `scope`, `acceptance`, `artifacts` | Delivered boundaries, original case/contract references, relevant changes or investigation findings, commits/diff and PR URL/readiness where changes are retained. An authorized disposable trial explicitly records the exception to publication. |
| `revision`, `environment` | Delivered source identity and each proof target. Do not claim earlier proof covers later affected changes. |
| `contributions`, `findings_resolution` | Contribution links and each material finding's disposition, supporting recheck or reason, owner acceptance where required, and remaining owner/next action. |
| `proof`, `gaps`, `decisions` | Case-by-case actual observations and required independent reviews; unresolved decisions and remaining proof, including applicable but untested surfaces. |
| `authority`, `limits`, `next_action` | Actions taken under the original grant, approvals still needed, consumed/remaining limits where available, and a bounded next step with its owner. Report elapsed time, cost if available, retries and human intervention; unknown cost stays unknown. |
| `delivery`, `follow_up` | Result artifact and observed return/receipt if one exists, otherwise delivery unverified; release/exposed revision and outcome observation remain with the COS/owner. Sending a result externally requires authority. |

`completed` means the assigned engineering outcome and required acceptance/review gates were satisfied, or a required limitation was explicitly accepted by the owner with its evidence gap retained. It does not mean merged, released or the external signal resolved. A read-only investigation can complete without a PR. `partial` means useful work or a draft exists but required proof/review or acceptance remains incomplete. `blocked` means progress on the required next step depends on a named decision, authority, environment or limit; retain completed independent work and name the owner and resumption condition. A draft PR can accompany either incomplete status. Do not use `completed` merely because a command passed or a contributor finished.

When useful partial work coexists with a blocker on the required next step, use `blocked` for the consolidated status and describe that partial work. Use `partial` when required work remains and an authorised next step can still proceed. Do not restart checks after exhausting the retry limit without a revised grant; read-only reconciliation can continue only within its remaining authority and budget.

## Proof fields

For each material case/risk record `case_id`, `check`, exact `revision` (and build/deployment or dirty patch identity where relevant), `environment`, `surface`, `actor`/fixture, expected and actual `observation`, `outcome` and durable `evidence` reference. Use [proof outcomes](../../verify/references/proof-policy.md#run): `pass`, `fail`, `inconclusive`, `skipped`, `not applicable`. Give a reason for unavailable or excluded coverage. Preserve first failures, attempts and remaining gaps; cleanup does not erase them. Keep full runner output ignored locally or in CI artifacts, with a concise durable report and selected evidence. A text contract or routing assessment is not observed agent delivery or product proof.

## Host handoff and resume

The host supplies the assignment snapshot; the lead returns the consolidated result through the authorised channel or leaves a reviewable local artifact when delivery authority is absent. The host maps these statuses into its own lifecycle and acknowledges delivery. astack supplies neither a queue nor an acknowledgement mechanism.

On resume, read the same work record/assignment and latest result, inspect the actual checkout, PR and available proof, and reconcile revision, owner, authority, remaining limits and open findings before further work. Reuse the work ID and existing PR where appropriate. A new attempt does not reset authority or silently refill a budget. Conflicting/stale assignment snapshots require host/owner reconciliation before dependent mutation. Independent read-only checks can establish current facts.

The external pilot must prove durable source/attempt/result identities, restart/resume, replay/duplicate handling, bounded concurrency/retries and result delivery on the chosen host. The host must prevent replay from creating duplicate tasks, PRs or messages. Carrying IDs and describing resume here does not establish those guarantees. Add a machine representation only when the integration needs it, preserving these meanings and validating input at that trust boundary.

See [worked handoffs](handoff-examples.md) for concise direct and COS-shaped examples, including partial proof and blocked decisions.
