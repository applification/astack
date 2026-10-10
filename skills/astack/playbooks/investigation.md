---
name: investigation
route: investigation
---

# Investigation

1. **research**: Use [investigate](../../investigate/SKILL.md) to gather relevant code, history, primary sources or runtime observations. For agent or skill comparisons, use [agent-evaluation](../../agent-evaluation/SKILL.md). This is read-only unless the task authorizes changes.
2. **design**: Separate fact from inference and compare options when asked. Use [show-me](../../show-me/SKILL.md) when a view clarifies the answer.
3. **lead**: Return the source-grounded answer, recommendation and uncertainties. Stop with the answer; create no implementation or PR merely to complete a workflow.

The lead owns integration. Resolve model roles through [orchestration](../references/orchestration.md); inherited roles may run directly. Preserve the task’s authority and report omitted steps with reasons.
