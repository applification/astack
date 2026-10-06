# Agent Observatory context

An installed `agentlog` captures persisted Codex turns independently of the agent and web UI. It is optional to the engineering method. Capture/forwarding failures must never block work, change the agent result, or trigger repeated troubleshooting during a task.

Keep work identities owned by their originating COS or dispatcher. When an actual launcher knows the session ID, bind it with `agentlog link --session SESSION_ID --work WORK_ID --project PROJECT_ID`; this also updates already captured runs. A `codex exec --json` launch through `agentlog run --work WORK_ID --project PROJECT_ID -- codex exec --json ...` binds automatically from `thread.started`. Other launchers may propagate stable `ASTACK_WORK_ID`/`ASTACK_PROJECT_ID` through owner-trusted asynchronous hooks. Do not invent a work tracker or fabricate identities for ordinary direct requests.

When available, explicitly record meaningful workflow transitions with `agentlog workflow --session SESSION_ID --turn TURN_ID --name WORKFLOW --step STEP`. Record an engineering outcome only with evidence using `agentlog outcome ... --value success|failure|unknown`; completion of a model turn is not proof of work success. These operations write only local metadata and queue it.

Use Observatory evidence to improve skills and instructions. Compare matching hash/provenance groups, inspect supporting traces, and keep descriptive correlations separate from causal claims. Do not assume a current file hash was the version used historically. Readable capture redacts secrets before buffering; the trace's Show content toggle only hides details on screen. Machine capture can separately use metadata-only mode. Capture gaps stay visible.
