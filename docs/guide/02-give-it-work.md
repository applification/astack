# Give astack work

State the outcome, constraints and finish condition in ordinary words:

```text
$applification:astack Saved items disappear after reopening. Reproduce it, fix the cause and prove a saved item survives a fresh read.
```

That selects bug-fix. astack finds the project control route and relevant data/UI expertise, reproduces the symptom, implements a supported repair and verifies the same behavior. The skill supplies the method; you supply the intent.

The main session is already the orchestrator; no extra role prompt is needed. It keeps the plan and finish conditions, delegates useful bounded contributions through the available host, and owns their integration and final verification. A small task can stay in one session. Children return evidence to the parent, including its supplied evaluation task ID; the owner controls evaluation start and delivery.

Other requests change the selected workflow:

| Request | Work selected |
| --- | --- |
| Add JSON output; existing text output must stay identical | Implement, with checks for both outputs |
| Move parsing behind one interface; keep all outputs | Refactor, with a baseline and equivalence checks |
| Explain why retry ownership lives in the backend; make no edits | Investigate, with code/history evidence |
| Startup takes two seconds on this fixture; measure and improve it | Performance, with comparable measurements |
| Integrate and upgrade this project's runtime loop | Project setup, then control and verification |

A mixed request can compose several skills in dependency order. An unfamiliar engineering request gets a bounded plan from the applicable skills and project tools rather than a forced route match. For multi-step work, the plan names useful phases and checkable completion.

When context is already clear, follow-ups such as “do it” or “continue” carry it forward. Say “new task” when changing the goal. A status question does not cancel the current work.

Invoke a focused skill when you already know the job:

```text
$applification:verify Check this branch against the saved-items case. Report failures without repairing them.
```

That skill completes the bounded request and can read the same principles and project guidance. It does not require a trip through the coordinator. Missing project setup alone does not block a narrow task or authorize a stack upgrade.

Next: [Understand and shape the change](03-understand-and-design.md).
