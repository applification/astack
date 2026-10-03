# e2e verification integration

New astack web projects use Tester Army e2e for repeatable app verification and live inspection. Existing projects preserve working runners. Acceptance is checked independently of exploration's CI status.

| Case | Expected behavior | Check |
| --- | --- | --- |
| A1 | An isolated exact assertion confirms the reference defect; the same repro passes against the fixed variant and is retained as a regression | `examples/e2e-proof`, `bun run verify` |
| A2 | A rerun writes new evidence and leaves the original report/artifacts unchanged | Reference verification compares evidence digests and `rerunOf` |
| A3 | Wrong-instance/setup, locator, missing/unknown report and budget failures cannot confirm a product defect | Reference verification and report-policy tests |
| A4 | Green exploration with an exhausted or failed step remains inconclusive; an issue remains a candidate | Sanitized recorded exploration fixture and report-policy tests |
| A5 | Retry passes retain flaky status; skipped and empty selections do not become passes | Report-policy tests |
| A6 | Skill, setup, app control, PR rules, README, site and routing examples agree on the new default and retained boundaries | Plugin/site checks and full diff review |

Pencil and Storybook are skipped. This change defines verification policy and uses an unstyled teaching fixture; its correctness depends on observed interactions and report interpretation, not a visual design decision. Native mobile, authenticated persistence, fresh live exploration and installed-host configuration loading are outside this reference's proven scope.

Results and revision identity are retained in [evidence.md](evidence.md).
