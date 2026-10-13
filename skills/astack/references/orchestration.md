# Run the selected roles

The main agent owns the request, integration and final proof. Read the selected playbook and keep its ordered steps in a proportionate plan. Record skipped steps with reasons and reuse completed work on continuation.

For each substantive contribution, use the playbook's role and read `.astack/models.json` if present. Resolve that role using [model selection](../../setup-astack/references/models.md) and the packaged resolver against a fresh host catalog. For review, the same resolver selects both configured panel targets or the saved single reviewer. Explicit task choices override saved preferences; report the override without rewriting settings. Missing roles inherit the current model. Resolve every panel member before dispatching any of them. Unsupported pinned choices stop that contribution with a precise prerequisite; independent work can continue.

An inherited contribution may be done directly. Dispatch every pinned target through the actual host, even when its model matches the parent. Delegate inherited work when parallelism helps or independent review is required. The playbooks’ lead steps stay in the main session and are not configurable model roles. In T3 use `orchestrator_capabilities` and `delegate_task` for cross-provider targets; native delegation is suitable only when it preserves the selected target and host policy. Standalone Claude/Codex use their actual native capabilities. Setup never changes the parent thread's model. Provider settings and persistent modes belong to the host.

Each delegated brief includes:

- Task and role, with absolute skill/playbook paths the child must read.
- Project instruction paths and applicable rules, including any scoped instructions.
- Exact checkout path, commit SHA and working-tree state; name a diff/base when relevant. Freeze the reviewed source until its readers finish.
- Contribution scope and allowed actions. Reviews are read-only; keep one writer per worktree.
- Expected proof: acceptance cases, exact checks or observations, and any existing evidence to assess.
- Return format: reviewed revision, changes or prioritized findings with source locations and consequences, observed checks, remaining gaps and reported provider/model identity.

Assign only that contribution; a linked skill does not expand the brief to the whole playbook. Do not assume conversation history or that the child loaded the plugin.

In T3, retain each `taskId`, requested target and stable `clientRequestId` for retrying that dispatch. Compare the host-returned `providerInstanceId` and `model` to the resolved target both when accepted and when complete; missing or different identity is a failed contribution, never proof for the requested model. Follow `task_status`/`task_cancel` using the task handle; the backing `childThreadId` is not a task handle. A timeout does not cancel work: inspect the retained task rather than duplicate it. Require terminal success and `workState: result_available`; a waiting child or one with pending child runs is incomplete. For T3 review rounds, create a new delegated task with consolidated context and a new request ID; do not continue it by messaging the backing thread. Assess returned work before integration. A completed child does not complete the parent task.

The lead resolves findings against source and observations, verifies the integrated revision and finishes through [PR guidance](../../pr/SKILL.md) when publication is part of the assignment. A read-only investigation or review ends with its answer. Keep missing proof or independence explicit. Skills do not grant messaging, merge, release or destructive-action authority. Scheduling and durable task records remain host responsibilities.
