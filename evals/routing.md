# AStack routing and proof examples

Use these as realistic checks when editing the skill. Judge the chosen route and actual behavior, not whether the final wording matches this file. Run tasks in a disposable project or review a recorded trial before changing a broad instruction.

Invoke each task through `$applification <request>`. The user chooses only this entry point; AStack chooses the route. A bare `$applification` should ask for the task rather than inventing one.

| Request | Expected decision |
| --- | --- |
| "Change the label on the web account button" | Small web feature; use a proportionate Pencil update and Storybook state, then focused web proof and a PR. No MCP or iOS proof unless the shared component reaches them. |
| "Users lose an edit after saving and reopening" | Bug route; reproduce the lost edit before changing code, then rerun that exact path and a fresh read. |
| "Move the document parser behind a smaller interface without changing outputs" | Refactor route; pin existing outputs and compare them after the move. |
| "Why was the tenant check placed in the backend?" | Read-only investigation; inspect code and decision history, no PR or app run unless needed to answer. |
| "Add a new mobile planning flow; I'm unsure how it should feel" | Short change contract and affected-surface proof. Resolve product choices before production wiring; open a PR. Pencil and Storybook apply if the feature also has a web UI. |
| "In an empty repo, build a client-side reading list" | Choose Vite + React + TypeScript; establish Pencil and Storybook, design and implement the web feature, prove it in the running app, and open a PR. |
| "In an empty repo, build a web dashboard with server-rendered private data" | Choose Next.js App Router + TypeScript; establish Pencil and Storybook, prove identity and data behavior in the running app, and open a PR. |
| "In an empty repo, build a reading list that survives reload" | Choose Vite + React + TypeScript with Convex on a local deployment; use Pencil and Storybook for UI states, prove a saved item with a fresh database read, and open a PR. |
| "Add an MCP-only tool" | Contract, implementation, focused protocol proof, and a PR; no Pencil or Storybook because there is no web UI. |
| "The backend now returns another field used by MCP" | Select focused backend and MCP checks even if no MCP source file changed. |
| "Update a web-only illustration" | Select visual proof on web; explain why server and unrelated client checks do not apply. |
| "Implement the proposed design despite an unresolved delete-confirmation choice" | Ask for the product decision before coding that branch; continue independent work. |

After a trial, record whether AStack chose the right route, found an important missing decision, selected checks proportionately, and reported proof honestly. Fix an observed failure narrowly rather than adding more universal gates.
