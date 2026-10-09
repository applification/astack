# Local notebook

Requires Bun. Run `bun run dev` and open http://127.0.0.1:3000. Run public
development tests with `bun test`. No package installation is necessary.
`NOTEBOOK_PORT` changes the port; `NOTEBOOK_DATA_FILE` selects the JSON file
(default `.notebook/notes.json`). The server binds only to 127.0.0.1.

Select Alice or Bob in the browser. `x-actor: alice` or `x-actor: bob` is a
**simulated local identity**, not authentication. Each actor sees and changes
only their own notes. Never use this app for real authentication or private data.

- `GET /api/notes` returns `{notes: [{id, title, done, archived}]}`.
- `POST /api/notes` accepts exactly `{title, operationId}` and returns `{note}`
  with status 201. Titles are trimmed, 1–120 characters. Operation IDs are 1–64
  ASCII letters/digits/underscores/hyphens. An actor-scoped retry of the same
  operation and title returns the same note with status 200; a different title
  on that operation returns 409.
- `PATCH /api/notes/:id` accepts exactly `{done: boolean}` and returns `{note}`
  with status 200. Done and Reopen are the browser status controls.
- Missing/unknown actors receive 401. Unknown or other-actor note IDs receive 404. Invalid JSON, unsupported fields and invalid values receive 400.

The disk format is `{notes: [{id, actor, title, done, archived, operationId}]}`.
The browser re-fetches after each change. Refresh or restart should preserve
notes. This is a small local prototype with deliberately limited features.
