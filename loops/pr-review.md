---
name: pr-review
trigger: hourly, or when a pull request is opened or updated
skills: [astack, code-review, verify]
---

Review open pull requests in this repository.

1. List open, non-draft pull requests. Skip any whose current head commit you have already reviewed.
2. For each remaining one, apply the applification `astack` skill for the read-only review playbook: use the applification `code-review` skill and run the project's checks with the applification `verify` skill at its head commit. If a required model pin is unavailable, stop the run with a host/configuration gap, without a PR comment or marking any head reviewed. Report what you ran and observed.
3. Post one review comment per pull request: findings ordered by severity, each with file and line, then the check results. Name the reviewed commit so the next run can skip it. If you found nothing, say so in one line.

Do not push commits, approve, request changes or merge. If there is nothing to review, stop without commenting.
