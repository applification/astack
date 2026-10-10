# Record environment enforcement

Use the project's existing record. Keep only rules that still help a contributor make a decision.

| Demonstrated mistake and source | Environment change and owner | Command | Bad-case result | Valid-case result | Remaining gap |
| --- | --- | --- | --- | --- | --- |
| A client module imports a server-only package despite the project's recorded boundary. | Project import-boundary check, wired into local verification and CI. | The project's check command. | Disposable client-to-server import is rejected with the supported import path. | Client-to-domain import and the unchanged application pass. | Runtime data flow requires separate behavioral coverage. |

This row illustrates the meaning; populate real source/revision and observed results for the requested work. Do not copy it as a new project obligation without the same failure.

Record existing application violations as prerequisites for separate work. Application repairs and runtime abstractions are outside this skill's remit. Remove obsolete reminders when the check enforces their rule; keep one source of truth for the command.
