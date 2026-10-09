# Agent reliability and craftsmanship

Owner request: implement the proposed reliability improvements, with a clear path to manual validation in a new repository. Starting revision: `0ff54b0a15ab58fe5353f55175d5a9a62a28bbc5`.

## Acceptance

| ID | Observable result |
| --- | --- |
| C1 | A controlled comparison uses identical task fixtures, user goals, model/settings and limits (the explicit skill invocation is the treatment), with an evaluator fixed independently of the plugin revision. Every planned attempt has a retained terminal or unfinished state. Plain and astack conditions have explicit effective plugin configuration. |
| C2 | Evaluator-owned checks distinguish a seeded persistence/status defect, a missing title-edit feature, rejected cross-owner requests, malformed input and repeated operations. Checks execute the delivered service and verify authoritative persisted effects; fabricated self-reports cannot satisfy acceptance. Setup failures stay inconclusive and evidence survives cleanup. |
| C3 | New focused design, code-review, correction and agent-evaluation skills compose with existing routes. Consequential interfaces have caller-first sketches and ownership/invariants; fresh review has concrete risk triggers; recurring corrections have demonstrated safeguards. Routine edits remain proportionate. |
| C4 | Craftsmanship grades are separate from behavioral acceptance. Blinded review material omits candidate/model identity, uses an explicit rubric and calibration controls, and asks for a fresh-agent follow-up. No uncalibrated quality score establishes a successful experiment. |
| C5 | A documented command creates a genuinely new Git repository with a local running app. Manual instructions include candidate installation/activation, exact user prompts, browser and HTTP steps, expected results, evidence paths, fresh-session follow-up and a decision rule for adoption. |
| C6 | Negative-control checks, affected types/tests, portable plugin checks and an independent review pass. The PR distinguishes harness/fixture proof, observed fresh-agent delivery and remaining owner manual acceptance. |

## Implementation boundaries

The foundation's existing bounded `runAgent` machinery supplies process limits, retained streams and startup-error handling. A small local notebook fixture avoids credentials and cloud prerequisites for the first experiment. Its selectable local actor simulates ownership; it is not live authentication proof. Reusable engineering guidance stays in `skills/`; comparison tooling and its fixture are repository examples. Observatory continues preserving reported evidence and owner judgments; this change does not claim an automatic semantic judge or deployed comparison UI.

Parent owns guidance, contracts, documentation and integration. The runner contributor is the sole writer in `/tmp/astack-agent-eval-runner-20261009`, owning only comparison code, fixture and their tests. The parent is the sole writer in the task worktree. Reviewers are read-only.

## CLI contract for the contributor

Entry: `bun examples/foundation/scripts/agent-evals.ts`. Commands: `init NEW_REPOSITORY`; `check --project REPOSITORY --task bug|feature|followup --output NEW_DIRECTORY`; `run --candidate COMMIT --baseline plain|COMMIT --model MODEL --tasks bug,feature --repeats N --output NEW_DIRECTORY`, with bounded timeout/action/reasoning options. Provide help. `init` preserves an existing destination; `check` retains a report plus hashed observation artifacts and exits 0/pass, 1/fail, 2/inconclusive. `run` persists the full planned denominator before dispatch, alternates conditions, reuses the exact fixture and acceptance oracle, and exports blinded review packets. No model calls in deterministic checks or CI. The configured model is supplied explicitly, never substituted.

Task fixture: a Bun-served notebook with browser create/list/done/reopen interactions and JSON persistence. A seeded status-write defect supplies the bug request; title editing supplies the feature request; a small archive behavior supplies the maintenance follow-up. HTTP checks use two disposable actors, fresh service/file reads, and unseen invalid/boundary cases. The evaluator remains outside the delivered repo. Candidate prompts state ordinary user goals and necessary supported API semantics, without experiment/rubric/score language. Preserve ordinary project tests and neutral project guidance.

The initial real-agent smoke is bounded to one repeat of selected tasks on the configured model. Wider repeated suites, human blinded grading and owner browser acceptance remain explicit next validation steps, without claiming statistical improvement from a small sample.
