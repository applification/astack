---
name: lint-debt
trigger: weekly
skills: [astack, correct, verify, pr]
---

Pay down one slice of lint and type debt in this repository.

1. Find the project's lint and typecheck commands in its instructions or scripts, and run those that exist. If they pass, report that and stop. If no check exists, report the missing command and stop.
2. Pick the lint rule or compiler diagnostic with the most findings. Apply the applification `astack` skill to fix it in at most ten files, using the project’s configured roles and selected technology guidance. An unavailable model pin stops the run with a reported host/configuration gap. Use the selected project stack and existing checks; do not replace tools, disable a rule or add ignore comments to make them pass.
3. Rerun the same commands with the applification `verify` skill. The chosen diagnostic's count must go down and no other count may go up.
4. If the same mistake appears in code written since the last run, apply the applification `correct` skill to add a safeguard that stops it recurring.
5. Open one pull request with the applification `pr` skill. State the diagnostic, the count before and after, and what remains.

Check for an open pull request from an earlier run first and continue it instead of opening a second. Never merge.
