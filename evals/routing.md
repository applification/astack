# AStack routing and proof examples

Use these as realistic checks when editing the skill. Judge the chosen route and actual behavior, not whether the final wording matches this file. Run tasks in a disposable project or review a recorded trial before changing a broad instruction.

| Request | Expected decision |
| --- | --- |
| "Change the label on the web account button" | Small feature or edit; no design sprint, no MCP or iOS proof unless the shared component reaches them. |
| "Users lose an edit after saving and reopening" | Bug route; reproduce the lost edit before changing code, then rerun that exact path and a fresh read. |
| "Move the document parser behind a smaller interface without changing outputs" | Refactor route; pin existing outputs and compare them after the move. |
| "Why was the tenant check placed in the backend?" | Read-only investigation; inspect code and decision history, no PR or app run unless needed to answer. |
| "Add a new mobile planning flow; I'm unsure how it should feel" | Design sprint, short change contract, affected-surface proof. Resolve product choices before production wiring. |
| "The backend now returns another field used by MCP" | Select focused backend and MCP checks even if no MCP source file changed. |
| "Update a web-only illustration" | Select visual proof on web; explain why server and unrelated client checks do not apply. |
| "Implement the proposed design despite an unresolved delete-confirmation choice" | Ask for the product decision before coding that branch; continue independent work. |

After a trial, record whether AStack chose the right route, found an important missing decision, selected checks proportionately, and reported proof honestly. Fix an observed failure narrowly rather than adding more universal gates.
