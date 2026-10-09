---
name: lint-debt
trigger: weekly
skills: [typescript-best-practices, react, correct, verify, pr]
---

Pay down one slice of lint and type debt in this repository.

1. Find the project's lint and typecheck commands in `.astack/project.md` or the package scripts, and run them. If both pass, report that and stop.
2. Pick the single rule with the most findings. Fix it in at most ten files, applying the applification `typescript-best-practices` skill, and the applification `react` skill for component files. Fix the cause the rule message describes; do not disable the rule or add ignore comments.
3. Rerun the same commands with the applification `verify` skill. The chosen rule's count must go down and no other count may go up.
4. If the same mistake appears in code written since the last run, apply the applification `correct` skill to add a safeguard that stops it recurring.
5. Open one pull request with the applification `pr` skill. State the rule, the count before and after, and what remains.

Check for an open pull request from an earlier run first and continue it instead of opening a second. Never merge.
