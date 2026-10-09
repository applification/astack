---
name: bug-fix
trigger: daily
skills: [bug-fix, testing, verify, pr]
---

Fix one reported bug in this repository.

1. Pick the oldest open issue labelled `bug` that has no assignee and no linked pull request. If there is none, stop.
2. Apply the applification `bug-fix` skill. Reproduce the reported symptom before changing code. If you cannot reproduce it, comment on the issue with exactly what you tried and what you observed, then stop.
3. Fix the cause the reproduction supports and keep the change inside the reported behavior. Add a regression check with the applification `testing` skill when it would have caught this bug.
4. Rerun the original reproduction with the applification `verify` skill.
5. Open one pull request with the applification `pr` skill, linked to the issue, stating the symptom, the cause and the before and after observations.

One issue per run. Never merge and never close the issue yourself.
