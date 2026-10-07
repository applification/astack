# Agent Observatory context

An installed `agentlog` captures persisted Codex turns independently of the agent and web UI. It is optional to the engineering method. Capture/forwarding failures must never block work, change the agent result, or trigger repeated troubleshooting during a task.

Keep work identities owned by their originating COS or dispatcher. When an actual launcher knows the session ID, bind it with `agentlog link --session SESSION_ID --work WORK_ID --project PROJECT_ID`; this also updates already captured runs. A `codex exec --json` launch through `agentlog run --work WORK_ID --project PROJECT_ID -- codex exec --json ...` binds automatically from `thread.started`. Other launchers may propagate stable `ASTACK_WORK_ID`/`ASTACK_PROJECT_ID` through owner-trusted asynchronous hooks. Do not invent a work tracker or fabricate identities for ordinary direct requests.

When available, explicitly record meaningful workflow transitions with `agentlog workflow --session SESSION_ID --turn TURN_ID --name WORKFLOW --step STEP`. Record an engineering outcome only with evidence using `agentlog outcome ... --value success|failure|unknown`; completion of a model turn is not proof of work success. These operations write only local metadata and queue it.

## Record the route and path

Use the selected astack route's identifier (`bug-fix`, `implement`, `performance`, `investigate`, `refactor`, `pr`, `project-setup`, `app-control`, or `cloud-transition`). The UI labels `implement` as New feature. Select it when interpreting the prompt, give a concise visible reason, and record only useful phases. Suggested plans are defaults, not mandatory checklists.

```sh
agentlog workflow --session SESSION_ID --action context
agentlog workflow --session SESSION_ID --turn TURN_ID --action select --name bug-fix --reason "Restore the existing save behaviour and rerun the reported symptom." --request-event PROMPT_EVENT_ID
agentlog workflow --session SESSION_ID --turn TURN_ID --action phase --step reproduce --status started --summary "Reproduce save and reopen on a disposable document." --skills bug-fix app-control
agentlog workflow --session SESSION_ID --turn TURN_ID --action phase --step reproduce --status completed --summary "Reopening returns the previous value." --skills bug-fix app-control --evidence RESULT_EVENT_ID
```

Selection returns a `flowId` and `eventId`. Later transitions in the same session default to its last selected flow; use `--flow FLOW_ID` to continue a specific flow in later turns or another captured session in the same project. Start a new selection for a new intended outcome. Context lists captured turn/prompt IDs and the last flow; it does not decide which historical turn represents the active request. Use actual host/capture identities, never guessed IDs. If the active turn has not been captured yet, continue delivery without blocking for telemetry.

Phases use `started`, `completed`, `failed` or `omitted`. Supply the observation or omission reason with `--summary`, declare the skills actually applied with `--skills`, and cite already captured action/result events with `--evidence`. A failed attempt followed by a fresh start retains both attempts. Route changes use `--action change --name ROUTE --reason REASON`; customize the proposed phases with `--plan PHASES...`. Reasons describe decisions the owner needs to assess, not private reasoning. Existing unstructured `--name/--step` calls remain compatible but do not establish a selected route.

Delegated children have independent journeys and local skill reads. A fork, a completed spawn call, a returned child result or host delivery does not declare parent integration. When using a child result, record an explicit join with the captured delegation ID and the child's result event; pair `--branches` and `--evidence` in the same order. Context includes recorded delegation identities. Continue without recording if the host or collector has not exposed the required evidence.

```sh
agentlog workflow --session SESSION_ID --turn TURN_ID --action join --summary "Used the UI and data recommendations to define the regression checks." --branches UI_DELEGATION_ID DATA_DELEGATION_ID --evidence UI_CHILD_RESULT_EVENT_ID DATA_CHILD_RESULT_EVENT_ID
```

Child conversations stay separate even when they use the same flow or phase name. An optional `--attempt ATTEMPT_ID` distinguishes overlapping attempts within one conversation; use the same identity on its start and finish. These records describe phase order and declared skill groups, not skill-to-skill caller relationships.

Readable capture must be enabled. Recording validates project scope and references, redacts before local queueing, and never changes outcome grades. Missing identities, collector versions, capture gaps or forwarding failures leave telemetry unknown; do not repeatedly troubleshoot them or let them delay the engineering task. The backend and collector must be upgraded together before structured annotations are used.

## Automatic task evaluations

When owning a substantive task in a project with agentlog readable capture, automatically record its acceptance criteria at the start and queue its evaluation at delivery. This is part of the task handoff, without asking the user to write a manifest or opt in again. Preserve one returned task ID across follow-ups; contributors reuse the owner's task instead of creating duplicate evaluations.

```sh
agentlog evaluation begin --title "Preserve saved edits" --case "The saved edit survives reopening." --skill "bug-fix=Reproduce the failure and repair its cause."
agentlog evaluation finish --task RETURNED_TASK_ID --proof ACTUAL_PROOF_REPORT
agentlog evaluation status --task RETURNED_TASK_ID
```

In a native Codex host, the CLI uses the trusted `CODEX_THREAD_ID`/`CODEX_SESSION_ID` and resolves the active turn through the native reader. An explicit `--session SESSION_ID --turn TURN_ID` overrides that lookup. Other hosts use the actual canonical `--run CAPTURED_RUN_ID`. Never invent these identities or select an unrelated historical turn. Begin requires an active native turn when resolving implicitly; use an explicit original run for a deliberate late declaration. The stored recording timestamp makes lateness visible.

Each repeated `--case` becomes C1, C2, etc.; repeated `--skill name=expected` becomes S1, S2, etc. Preserve criteria agreed from the request. A material change of scope starts a fresh `--task UUID`; do not rewrite the prior criteria after seeing results. Supply a structured proof report only when it exists, using matching case IDs. Otherwise omit `--proof`: the review still appears with incomplete checks. Never fabricate revision, source digest, observations or artifact hashes to satisfy the schema.

Call finish when handing the task's result back, including failed or incomplete delivery. It may return `pending` while the final message has not yet been captured. The collector resolves the explicit start/end turn boundaries, links the original prompt and follow-ups, and publishes once after capture catches up. Do not poll for publication or let capture delay the final result. Identical begin/finish retries are idempotent; status reports a persisted generation failure. Report an unavailable/unsupported CLI as an evidence gap and continue the engineering work.

Observatory's run-detail **Generate evaluation** button is the backup for captured work. It uses that selected turn's exact request as its review criterion and labels the absence of task-specific acceptance/skill criteria and structured proof. Generation does not assign owner judgment. Upgrade the backend and collector, and refresh the installed Astack skill package, to activate this handoff; deploying only the UI does not update host instructions.

Use Observatory evidence to improve skills and instructions. Compare matching hash/provenance groups, inspect supporting traces, and keep descriptive correlations separate from causal claims. Do not assume a current file hash was the version used historically. Readable capture redacts secrets before buffering; the trace's Show content toggle only hides details on screen. Machine capture can separately use metadata-only mode. Capture gaps stay visible.
