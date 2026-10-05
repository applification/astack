# Worked handoffs

These synthetic examples show `astack-handoff/v1` text usage. They are not delivery trials or external host observations. Placeholder revisions and evidence links must be replaced by actual identities in a real result.

## Small direct fix

Assignment, kept in the conversation:

```text
contract_version: astack-handoff/v1
work_id: caller chat identity (issuer: caller)
origin: direct human request; return here
outcome: Correct the account button label to “Account”.
scope: Existing browser label only; no interaction or shared API changes.
acceptance: A1 — the actual account button displays “Account”.
context: Existing app/profile and browser control command.
authority: Requested local fix, checks and PR; merge/release/messages require owner authority.
execution: Lead is the only writer in the named checkout; record its base/current revision.
limits: No explicit caller budget; no automatic retry or concurrency policy supplied.
```

The lead selects Feature, no separate specialist, and a visible browser check. It checks whether the label reaches another surface and records relevant design/component decisions. A concise result carries the same `work_id`, lead/route, scope, commit and PR, A1's actual revision/environment/observation/evidence, self-review, any gaps and the owner's next action. No additional contract file is necessary.

## COS assignment with shared permissions

```text
contract_version: astack-handoff/v1
work_id: COS-42 (issuer: selected host)
assignment_id: assignment-7
attempt_id: attempt-1
origin: COS; return artifact to the supplied work record, no Slack reply authorised
sources: Supplied Slack event/link/time; report claims another user's item is visible.
         Reproduction unknown; report is a candidate, not established fact.
outcome: Each user can read only their own items on web and MCP.
scope: Inspect and repair read ownership; preserve write behavior and API shape.
acceptance: A1 — owner can read; A2 — second user cannot read on web;
            A3 — second user cannot list/read through MCP.
context: Repository/profile, accepted ownership ADR, feature map and control commands.
authority: Disposable local actors, repository repair, checks and draft/ready PR.
           No live provider identity, external messages, merge or release.
execution: Lead writer in worktree W1; backend/data and security contributions;
           independent read-only reviewer of pinned delivered revision.
           Lead owns shared permission contract and integration. Record base/revision/target.
limits: One writer, maximum two concurrent read-only contributions;
        30 minutes total, one setup retry; stop dependent work when limit is exhausted.
decisions: None initially; escalate if intended sharing differs from the ownership ADR.
```

The lead selects Bug fix and reproduces before changing code. Backend/data traces consumers and the actual operation; security examines allowed/denied actors and token boundaries. Convex changes still require its expert and reviewer. Roles can be combined if useful, with independence disclosed.

A security brief carries `COS-42`, `assignment-7`, `attempt-1`, `contribution_id: security-1`, A1–A3, relevant code/context and the pinned revision/target. It permits read-only inspection and disposable local checks, gives a budget inside the parent limits, and returns findings to the lead. It grants no write, messaging or live identity authority.

Example contribution: `status: completed`, `role: security`, independent read-only actor, reviewed revision and target; finding `F1` is a confirmed MCP read-isolation defect linked to A3 with reproduction/evidence and impact. The reviewer completed its scope; the lead's work is still incomplete.

If repaired, `findings_resolution` records `F1: fixed` with the new revision and A3 recheck. A rejected candidate uses `not confirmed` and evidence. A confirmed acceptance defect can remain only with explicit owner acceptance recorded; an advisory recommendation can be declined with a reason. All dispositions preserve the original finding identity.

## Partial proof

For the same assignment, suppose local A1 and A2 pass but the required running MCP check cannot start:

```text
work_id: COS-42; assignment_id: assignment-7; attempt_id: attempt-1
status: partial
lead/route/selection: Lead; Bug fix; backend/data, security, independent delivery review.
artifacts: Repair commit and draft PR; original acceptance/contract links.
revision/environment: Actual delivered commit and named local runtime/fixtures.
proof: A1 pass and A2 pass with actual observations/evidence.
       A3 inconclusive — endpoint startup failed before read isolation was observable.
findings_resolution: F1 open — code repaired but required running recheck unavailable.
gaps: A3 and required affected review remain outstanding. Live OAuth not exercised.
authority/limits: Local actions only; initial setup failed, one authorised retry remains;
                  elapsed/cost as available.
next_action: Lead restores MCP startup and reruns A3 within remaining limits;
             owner resolves any additional environment access needed.
delivery/follow_up: Result artifact prepared; external return receipt unverified.
                  COS owns release and outcome follow-up after explicit authority.
```

Static checks or component screenshots cannot replace A3. If MCP was never run, use `skipped` with the reason instead of `inconclusive`. The result is partial while a permitted next step remains. If the setup retry is exhausted and the required check needs another attempt, return blocked with the owner/host's limit decision as the resumption condition. An explicit acceptance retains the gap; first failures stay linked.

## Blocked decision and resume

If investigation finds an intentional sharing path that conflicts with the supplied ownership outcome, return `status: blocked`, the same work/assignment/attempt identities, independent findings and draft artifact if any. Name the sharing decision, the owner, evidence and options, the actions deferred, remaining budget, and the exact resumption condition. Do not remove sharing or weaken A2/A3 by inference.

On an owner answer, the host supplies the reconciled assignment under the same work ID. Record the changed scope/acceptance and authority, inspect actual revision/ownership/PR, and continue the existing work. Recheck affected cases and close each finding with evidence. Replay must be reconciled by the host before dispatch; these examples demonstrate no duplicate-handling implementation.
