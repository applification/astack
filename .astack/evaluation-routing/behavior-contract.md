# Evaluation routing and skill capture repair

Generated evaluations must show available skill evidence even when no agent declared a structured route. Future T3 captures must recognize ordinary successful shell reads, and agents must be able to invoke the installed collector without a global PATH change.

## Acceptance

- R1: The reported generated evaluation shows its captured parent skill sequence with exact trace links, including repeated reads. Missing route/phase declarations remain explicit.
- R2: Recorded routes, phase retries, child lanes and explicit joins retain their existing behavior. Observed parent reads are disclosed separately from phase declarations. Prompt/result lines follow visible stops when that disclosure opens or closes.
- R3: Successful T3 shell wrappers and multiple literal read paths produce skill evidence. Failed commands, quoted examples, variable paths and ambiguous shell compositions do not. Upgrading replays previously checkpointed T3 history once, preserving existing event identities and source ownership.
- R4: The bundled launcher reaches the private collector install when `agentlog` is absent from PATH. The installed Observatory reference directs agents through that launcher for route/phase and evaluation recording.
- R5: Current readable-capture/project/machine policy governs skill projection; paused projects expose no reads. Parent reads are bounded to 64, child reads to 32 and the existing shared byte budget remains enforced. Evaluation snapshots and owner grades are unchanged.

## Supported causes

Authenticated inspection of the reported evaluation found one linked run, no structured workflow records and no branches. Its full trace contains 19 skill events. The query previously projected ordinary reads only for children; the view drew no parent map without explicit workflow annotations.

Independent read-only collector diagnosis confirmed that the supplied agent checked `command -v agentlog`, found no executable and recorded the handoff as unavailable. The private binary was installed and healthy. Another recent T3-owned run contained successful `/bin/zsh -lc 'cat …/SKILL.md'` commands but no skill events: the parser recognized only a bare reader with one path. The older illustrated evaluation had explicit route/phase/join annotations recorded after delivery.

## Design and proof

Pen is skipped because this repair reuses the existing connected-map layout and skill icons. Storybook covers observed-only and recorded-plus-observed paths, exact links, repeated reads, desktop/narrow geometry and disclosure changes. Native Convex checks cover real generation and current-policy projection; collector checks cover shell parsing, failure exclusions, deduplication and checkpoint upgrades. An owned anonymous backend push and live Otis readback are separate verification claims.

The initial parent-read regression failed because the projection lacked reads; the same test passes after repair. Early verification setup failures were missing checkout dependencies, a capitalization mismatch in a new browser assertion, an incorrect new test invocation of `persistSnapshot`, and a local backend that was not kept running. Raw reports stay ignored under `.proof/evaluation-routing`; retained pixels use synthetic data.
