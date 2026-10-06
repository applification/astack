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

Readable capture must be enabled. Recording validates project scope and references, redacts before local queueing, and never changes outcome grades. Missing identities, collector versions, capture gaps or forwarding failures leave telemetry unknown; do not repeatedly troubleshoot them or let them delay the engineering task. The backend and collector must be upgraded together before structured annotations are used.

Use Observatory evidence to improve skills and instructions. Compare matching hash/provenance groups, inspect supporting traces, and keep descriptive correlations separate from causal claims. Do not assume a current file hash was the version used historically. Readable capture redacts secrets before buffering; the trace's Show content toggle only hides details on screen. Machine capture can separately use metadata-only mode. Capture gaps stay visible.
