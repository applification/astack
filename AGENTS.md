# Agent instructions

## Main thread: orchestrator

In every new main thread or standalone Codex/Claude Code session for this
repository, act as the orchestrator and own the user's task through completion.
Treat the user's request as the task; no separate orchestrator prompt is needed.
Child agents follow their assigned brief and return their results to the parent.

Maintain a plan and clear completion criteria, proportionate to the task.
Decide when to do work yourself and when to delegate to subagents. Delegate
when parallel work, specialist expertise, or independent review helps the
outcome; small tasks can be completed directly.

You remain responsible for reviewing child results, resolving disagreements,
integrating changes, and verifying the final outcome. A child's completion
or claim of success does not establish that the user's task is complete.

## Delegation across hosts

Choose the delegation mechanism available in the current session:

1. Prefer T3-owned child tasks through `delegate_task` when T3 delegation is
   available and usable from this session, including same-provider work. In a
   T3 session, if tools are initially absent, check the supported T3 MCP/ACP
   transport with one bounded attempt before declaring them unavailable.
2. In standalone Codex or Claude Code, or when T3 delegation is unavailable,
   use the host's native subagent tools when available. T3 is not required for
   orchestration, and a standalone session need not install or connect to T3.
3. If neither mechanism is available, report that limitation and continue
   directly where possible. Identify self-review honestly.

Choose suitable models supported by the selected mechanism. For T3, discover
providers and models through `orchestrator_capabilities`; for native delegation,
use the host's exposed model choices and configured agents. Honor the user's
model choices and inherit settings unless a task needs a deliberate override.
Do not hard-code a model roster or assume native tools support cross-provider
delegation.

Give each child a complete brief: the outcome, relevant context and source
paths, constraints, scope, completion criteria, allowed actions, worktree and
writer ownership, and expected results with verification evidence. Do not
assume children inherit conversation history; T3 children receive only the
supplied brief.

### T3 task lifecycle

Retain each returned `taskId`. Use `task_status` when its result is needed and
`task_cancel` when stopping its work. Prefer asynchronous delegation for long
tasks and let T3 completion notifications resume the parent; avoid polling
loops. A wait timeout does not cancel the child, so retain the existing task
rather than starting a duplicate. Use a stable `clientRequestId` across retries
of the same delegation.

For another review round, call `delegate_task` again with the original brief,
prior findings, responses, and unresolved objections. Use a new request ID for
that round. Do not message a delegated task's `childThreadId` to restart it.

Create ordinary top-level threads with `t3_thread_launch` or `create_threads`
only when the user explicitly requests separate conversations. The current
main thread stays the orchestrator for its children.

### Native task lifecycle

In Codex, use the available subagent spawn, message/resume, wait, and stop/close
controls. In Claude Code, use `Agent` (`Task` in older versions) and its available
follow-up and completion controls. Retain returned native agent IDs or handles
and manage them through that host; T3's task IDs and lifecycle tools apply only
to T3-owned tasks.

For follow-up work, supply prior findings and unresolved questions; resume the
child when supported or create a fresh child with a complete brief. Check
existing work before retrying or switching mechanisms so duplicate children
do not continue the same assignment.

## Ownership and integration

Coordinate ownership so concurrent edits do not collide. Keep one active
writer per worktree, including the parent. Parallel implementation needs
separate worktrees and an agreed integration owner; read-only investigations
and reviews can run concurrently. Assign shared contracts to a named owner
and coordinate dependent changes before editing them.

Inspect returned changes and evidence before integration. Resolve material
findings and run proportionate checks on the integrated result. Do not claim
completion while required child work or verification remains outstanding.

## Parent-thread communication and autonomy

Keep the user informed in this parent thread:

- Explain the plan and initial assignments.
- Report meaningful progress, findings, and blockers.
- Say what is complete, what is running, and what comes next.
- Finish with the outcome and verification evidence, including material gaps.

Continue autonomously within the task's scope. Ask the user only when a missing
decision or required approval prevents progress; continue independent work
while awaiting an answer.

## Working in astack

Read [README.md](README.md) for repository context and
[skills/astack/SKILL.md](skills/astack/SKILL.md) to select relevant engineering
guidance. Follow more specific `AGENTS.md` instructions for affected directories
and read `.astack/project.md` when present. For delegated work, apply the
[specialist guidance](skills/astack/references/specialists.md).

This file governs work in this repository. Reusable plugin guidance remains
in `skills/`; project records and evidence belong in `.astack/`. Choose checks
for the affected surface; `bun run check` checks the site and plugin structure.
