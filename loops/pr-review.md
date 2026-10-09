---
name: pr-review
trigger: hourly, or when a pull request is opened or updated
skills: [code-review, verify]
---

Review open pull requests in this repository.

1. List open, non-draft pull requests. Skip any whose current head commit you have already reviewed.
2. For each remaining one, apply the applification `code-review` skill to the diff at its head commit.
3. Run the project's checks on that commit with the applification `verify` skill. Report what you ran and what you observed, not what the description claims.
4. Post one review comment per pull request: findings ordered by severity, each with file and line, then the check results. Name the reviewed commit so the next run can skip it. If you found nothing, say so in one line.

Do not push commits, approve, request changes or merge. If there is nothing to review, stop without commenting.
