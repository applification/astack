---
name: bug-fix
trigger: daily
skills: [astack, bug-fix, testing, verify, pr]
---

Fix one reported bug in this repository.

1. Pick the oldest open issue labelled `bug` that has no assignee and no linked pull request. Skip issues with an `astack: needs-reproduction` comment unless the author or a maintainer has supplied new reproduction information since it. If there is none, stop.
2. Apply the applification `astack` skill to run the bug-fix playbook with the project’s configured roles. Use the applification `bug-fix` skill for diagnosis. An unavailable model pin stops the run with a host/configuration gap; do not post a needs-reproduction comment for it. Reproduce the reported symptom before changing code. If an actual reproduction attempt cannot establish the symptom, post one comment beginning `astack: needs-reproduction`, stating what you tried, what you observed and the missing information, then stop. Do not repeat that comment without new reproduction information.
3. Fix the cause the reproduction supports and keep the change inside the reported behavior. Add a regression check with the applification `testing` skill when it would have caught this bug.
4. Rerun the original reproduction with the applification `verify` skill.
5. Open one pull request with the applification `pr` skill, linked to the issue, stating the symptom, the cause and the before and after observations.

One issue per run. Never merge and never close the issue yourself.
