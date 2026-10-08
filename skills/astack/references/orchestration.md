# Main-thread orchestration

In every new main conversation or standalone agent session, the main agent owns the user's task through completion. The request is the task; no separate orchestrator prompt is needed. A delegated child follows its bounded brief and returns to its parent. Direct invocation of a focused skill keeps the same ownership.

Keep a proportionate plan and clear finish conditions. Delegate when parallel work, specialist expertise or independent review helps the outcome; a small task can be completed directly. There is no required child count or role roster. The parent reviews returned findings and artifacts, resolves disagreements, integrates changes and verifies the combined result. A completed child, model turn or host delivery does not complete the parent task.

## Select the available host mechanism

Use the actual host's capabilities and instructions. T3 is optional; a standalone session does not need to install or connect to it.

- In T3, discover providers and models through `orchestrator_capabilities`. Use native same-provider delegation when the host prefers it and it supports the chosen model; use T3-owned `delegate_task` for models native tools cannot run, cross-provider work or explicitly T3-owned children. If T3 tools are initially absent, make one bounded capability attempt through the supported MCP transport or the ACP `acp-mcp-call` fallback when the host exposes `T3_ACP_MCP_NODE`; initial catalog absence alone is not proof of unavailability.
- In standalone Codex or Claude Code, or when T3 delegation is unavailable, use the host's native subagent tools if available. Select from its exposed models/configured agents. Honor user choices and inherit settings unless the task warrants a deliberate override; do not hard-code a model roster.
- If delegation is unavailable, continue directly where possible and identify self-review. A required independent review remains a gap.

Give every child a complete brief: outcome, source paths and relevant project context, scope/exclusions, finish conditions, allowed actions, revision/environment, worktree/writer and integration ownership, limits, escalation and the expected result with verification evidence. Do not assume inherited conversation history; T3 children receive only their supplied brief. Use [specialist contributions](specialists.md) and [portable handoffs](handoffs.md) when those contracts help.

## Manage children through their host

For a T3-owned child, retain the returned `taskId`. Prefer asynchronous delegation for long work and let completion notifications resume the parent. Read `task_status` when the result is needed; use `task_cancel` to stop it. A wait timeout does not cancel the task. Retain the existing task and a stable `clientRequestId` across retries instead of dispatching duplicates. For another review round, call `delegate_task` with a new request ID and a complete brief including prior findings, responses and unresolved objections. Do not restart it by messaging its backing `childThreadId`. Ordinary top-level launch tools are for explicitly requested separate conversations, not delegated work.

For a native child, retain its agent ID/handle and use native spawn, message/resume, wait and stop/close controls as exposed. Supply prior findings and unresolved questions on follow-up; resume the child when supported or create a fresh child with a complete brief. T3 task IDs and lifecycle commands do not apply to native children. Inspect existing work before retrying or switching mechanisms so duplicate children do not continue the assignment.

## Integrate and communicate in the parent

Keep one active writer per worktree, including the parent. Parallel implementation needs separate worktrees and a named integration owner; read-only investigations/reviews can run concurrently against a pinned revision. Name shared-contract owners and coordinate dependent changes before editing.

Inspect returned changes and evidence before integration, resolve material findings, and run checks appropriate to the integrated revision and affected behavior. Required child work or proof still outstanding keeps the parent result incomplete. Preserve the owner-selected PR and external work identity; a child returns its commits/evidence to the owner rather than creating a competing delivery.

Explain the plan and assignments in the parent conversation. Report meaningful findings, what is complete/running, blockers and what comes next; finish with the outcome, observed verification and material gaps. Continue within scope, asking only when a missing decision or authority prevents the dependent step, while progressing independent work.

## Evaluation and capture ownership

The owning main agent begins and finishes the task evaluation when readable capture is available. Children return evidence and the supplied owner's evaluation `taskID`; they do not begin or finish duplicate parent evaluations. Active follow-ups reuse that ID. Once delivery creates an immutable evaluation, materially revised proof or intent needs a fresh ID; retain the earlier evaluation and the same external work identity. See [Observatory context](observatory.md#automatic-task-evaluations) for commands and capture limits.

Keep evaluation `taskID`, T3 delegation `taskId` or native agent handle, external `work_id`, and workflow `flowId` distinct. Root/child conversation correlation must come from typed host/capture relationships with their provenance; matching work IDs, phase names, fork lineage or a spawn's completion cannot establish a parent join. Record a join only when the parent actually uses the result and trusted captured delegation/result references are available. Missing capture is an evidence gap; this guidance does not establish runtime grouping or installed-host proof.
