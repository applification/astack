# Validate astack in a new repository

This is the first adoption experiment for the reliability and craftsmanship changes. It has three separate results: independently checked product behavior, blinded code-quality review, and your judgment of whether the agent delivered useful work with reasonable supervision. Record all three. A passing fixture does not establish live authentication, cloud deployment, arbitrary project quality or a statistical reliability improvement.

## Prepare the source and a genuinely new repository

Use Bun 1.4.0, Git and a signed-in Codex CLI that supports `exec --ignore-user-config`. Pin the astack checkout to the candidate commit being assessed. Keep the previous-release checkout or commit for comparisons. The runner requires an explicit model; use the same model and reasoning setting for both conditions.

From the astack checkout:

```sh
bun install --frozen-lockfile
bun install --cwd examples/foundation --frozen-lockfile
bun run agent-evals --help
bun run agent-evals init /tmp/notebook-pilot
```

`init` refuses an existing destination. The result is its own Git repository with a small Bun application, neutral project instructions and public development checks. It is separate from the astack source and the full Convex/WorkOS foundation. The local actor selector simulates ownership for disposable data; it does not authenticate users.

Keep evaluator reports outside the delivered repository. The evaluator comes from the pinned astack source and remains fixed when comparing plugin revisions. Record its suite digest alongside candidate and fixture identities. Ordinary development tests stay visible to the agent; held-out checks exercise supported behavior with additional inputs.

## Install and confirm the candidate

Use a full candidate commit SHA. For a local unpushed candidate, create a committed snapshot with its own marketplace; this keeps the source fixed and avoids editing the source checkout's catalog. Replace the source path and SHA below. Choose a different package directory and marketplace name for another experiment.

```sh
ASTACK_SOURCE=/absolute/path/to/astack
ASTACK_COMMIT=FULL_CANDIDATE_SHA
ASTACK_PACKAGE=/tmp/notebook-pilot-astack
mkdir "$ASTACK_PACKAGE"
git -C "$ASTACK_SOURCE" archive --format=tar --output=/tmp/notebook-pilot-astack.tar "$ASTACK_COMMIT"
tar -xf /tmp/notebook-pilot-astack.tar -C "$ASTACK_PACKAGE"
cat > "$ASTACK_PACKAGE/.agents/plugins/marketplace.json" <<'JSON'
{
  "name": "notebook-pilot-astack",
  "interface": { "displayName": "Notebook Pilot" },
  "plugins": [{
    "name": "applification",
    "source": { "source": "local", "path": "./" },
    "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
    "category": "Developer Tools"
  }]
}
JSON
codex plugin marketplace add "$ASTACK_PACKAGE"
codex plugin add applification@notebook-pilot-astack
codex -C /tmp/notebook-pilot plugin list --marketplace notebook-pilot-astack --json
codex -C /tmp/notebook-pilot --ignore-user-config -c 'plugins={"applification@notebook-pilot-astack"={enabled=true}}'
```

Keep the snapshot and installation output with your observations. Start the last command as a new session for each manual task, changing `-C` for a different repository. It uses an explicit plugin setting and skips personal configuration; managed host instructions can still apply. Record those residual conditions. Retain advertised skill names and startup errors; installation alone does not establish that a skill was used. The [project installation guide](project-install.md) explains persistent project configuration and removing unintended user-wide enablement. At cleanup, remove only this experiment's entries with `codex plugin remove applification@notebook-pilot-astack` and `codex plugin marketplace remove notebook-pilot-astack`; preserve unrelated entries.

Expected focused capabilities include `architect`, `code-review`, `correct` and `agent-evaluation`, alongside `astack`, `bug-fix`, `implement`, `testing` and `verify`. If the intended package did not load, record activation as inconclusive and repair the installation before judging delivery. Never reinterpret a missing package as an agent quality result.

## Manual bug task

Keep the app in one terminal and run checks from the pinned astack checkout in another:

```sh
NOTEBOOK_PORT=3173 bun run --cwd /tmp/notebook-pilot dev
```

Open `http://127.0.0.1:3173`. Stop with Ctrl-C and repeat that command to check persistence across restart. Use a different port for another app. In the browser:

1. Choose the first disposable actor, create two notes and record their titles.
2. Mark the first note done. Reload the page, stop/restart the server, and reopen the list. The seed intentionally persists the opposite status; retain this original failure.
3. Keep a failing independent baseline before asking the agent to repair it:

```sh
bun run agent-evals check --project /tmp/notebook-pilot --task bug --output /tmp/notebook-bug-before
```

The seeded persisted-status case must fail (exit 1). A setup error (exit 2) requires fixing the test environment first. Start a fresh agent session in this repository with this request:

```text
$applification:astack Marking a note done leaves it open, and reopening can leave it done. Reproduce this in the running app, fix the persisted state change, and retain a regression. Preserve ownership, input validation and the other note. Keep this exercise local; no publishing or PR is needed.
```

4. Repeat the same browser path after delivery. Done must survive reload and restart; reopen must persist open. The other note must retain its title and state.
5. Switch to the second actor. The first actor's notes must be absent. Try a direct update of the first actor's note through the documented HTTP API as the second actor; it must be rejected without changing the original record. The fixture README describes the exact headers and payloads.
6. Use a known Alice note ID from the first request below (replace `ALICE_NOTE_ID`). Bob's update must return 404, and Alice's fresh read must retain the record:

```sh
curl -s -H 'x-actor: alice' http://127.0.0.1:3173/api/notes
curl -i -X PATCH http://127.0.0.1:3173/api/notes/ALICE_NOTE_ID -H 'x-actor: bob' -H 'Content-Type: application/json' -d '{"done":true}'
curl -s -H 'x-actor: alice' http://127.0.0.1:3173/api/notes
```

Repeat this create twice as Alice. Expect 201 then 200 with the same note ID; reload/restart must still show exactly one new note:

```sh
curl -i -X POST http://127.0.0.1:3173/api/notes -H 'x-actor: alice' -H 'Content-Type: application/json' -d '{"title":"Retry check","operationId":"manual-retry-1"}'
```

7. Run the external check from the pinned astack source, with a new output directory:

```sh
bun run agent-evals check --project /tmp/notebook-pilot --task bug --output /tmp/notebook-bug-proof
```

Exit 0 means the selected behavioral acceptance passed; 1 means a product assertion failed; 2 means setup or proof was inconclusive. Inspect the report, observation artifacts and their hashes. Retain the initial failing report separately; do not overwrite it with the final run. Agent prose or a success toast cannot substitute for the fresh read.

## Manual feature task

Use a new initialized repository for an independent feature measurement. For a sequential owner exploration, you may instead continue the corrected bug repository, but record that it has inherited changes and is not the same controlled fixture.

For the independent feature task, initialize/start another app (the existing pinned candidate installation can be reused):

```sh
bun run agent-evals init /tmp/notebook-feature-pilot
NOTEBOOK_PORT=3174 bun run --cwd /tmp/notebook-feature-pilot dev
```

Open `http://127.0.0.1:3174` and start a fresh Codex session with `-C /tmp/notebook-feature-pilot` and the same explicit candidate configuration. For sequential exploration, use the corrected bug repository and its port instead; use that same path in the external check.

```text
$applification:astack Add title editing to an existing note in the browser and HTTP API. PATCH /api/notes/:id must accept exactly {title: string} as an alternative to {done: boolean}, returning {note}. Trim titles, accept 1–120 characters and reject malformed, empty, extra or mixed fields with 400. Saved titles must survive reload and restart. Preserve ownership, status, other notes and create retry behavior: the original normalized create input must still return the same note after editing and restart, while a different create input on that operation remains a conflict. Keep existing disk records compatible. Keep this exercise local; no publishing or PR is needed.
```

Observe whether the agent settles the caller/API shape and ownership before wiring a consequential change. A small implementation needs a small sketch. After delivery, edit a title, reload, restart and verify the persisted value. Submit an empty or malformed title and confirm rejection with the previous value preserved. Repeat a valid update and confirm it does not create another note. Check the second actor cannot edit the first actor's note. Exercise keyboard access to the edit/save interaction, including the error state.

Edit both an open and a completed note; each must retain its status through reload and restart. The independent feature seed has an unrelated status bug, so use HTTP `PATCH {done:false}` to obtain a completed control there, or use the successful bug repository for sequential exploration. Record this fixture limitation.

Create a note using the request below before editing it. Rename it in the browser, restart the app, then repeat the exact request. Expect 200 with the same ID and current edited title, with no duplicate. Change only the create title while keeping the operation ID: expect 409. Rename it a second time and repeat the original create request after restart; original request identity must stay fixed across multiple edits. Repeat on a note created before the agent changed the persisted format.

```sh
curl -i -X POST http://127.0.0.1:3174/api/notes -H 'x-actor: alice' -H 'Content-Type: application/json' -d '{"title":"Before title edit","operationId":"manual-title-retry"}'
```

```sh
bun run agent-evals check --project /tmp/notebook-feature-pilot --task feature --output /tmp/notebook-feature-proof
```

The generated fixture README and runner help are the authoritative API/command reference. The held-out checker is independent of the agent's mutable development checks.

## Fresh-agent maintenance and correction

Start a new session with the successful feature repository and ask:

```text
$applification:astack Add archive and restore for notes in the browser and API. PATCH /api/notes/:id must accept exactly {archived: boolean} as an alternative to its existing patch, returning {note}. GET /api/notes hides archived notes by default; GET /api/notes?includeArchived=true includes them for the archived view. Restore must retain the edited title and status. Preserve ownership, validation and create retry behavior, and make repeat requests safe. Keep this exercise local; no publishing or PR is needed.
```

Track its elapsed time, regressions, clarification and corrective prompts. Archive, reload/restart, inspect archived notes and restore. The original title/status must remain. The other actor must not gain access. Run the `followup` check in a new external output directory. This is evidence of changeability on this example, not a grade based on line count.

Keep a small observation log for each task: candidate SHA and model/settings, initial failure, final fresh-read result, denied request result, external report path, corrective prompts, unresolved findings and owner verdict. A successful automated check still leaves the browser/keyboard observations for you to record.

For the correction workflow, use a demonstrated repeated mistake from your trial. Ask `$applification:correct` to choose a safeguard within the existing scope. Require the same check to reject the preserved bad case and accept the correction. A new instruction alone does not close a mechanically enforceable failure.

## Controlled comparisons

The automated comparison command creates fresh repositories/sessions for the same user goals, fixes the oracle independently of the plugin commits and retains every planned attempt before dispatch:

```sh
bun run agent-evals run --candidate CANDIDATE_COMMIT --baseline plain --model CONFIGURED_MODEL --tasks bug,feature --repeats 1 --timeout-ms 300000 --action-limit 40 --output /tmp/notebook-comparison
```

Replace the uppercase values with the actual full commit SHA and configured model ID. The same command accepts a previous plugin commit as `--baseline`. Add the same explicit reasoning option to both conditions when used. The intentional treatment is loading/invoking astack; the user goal, fixture and acceptance oracle stay the same. Inspect recorded configuration and residual managed/global instructions before calling a plain condition skill-free.

Plugin revisions resolve in the evaluator's Git checkout by default. If the tooling is relocated, supply `--plugin-repo /absolute/path/to/astack` with the same pinned candidate/baseline commits. The manifest records the resolved repository; the evaluator and task fixtures remain fixed independently of those plugin revisions.

The optional standalone `followup` comparison starts from a fresh seed and measures archive-task behavior. It does not measure changeability of an earlier agent delivery; use the sequential fresh-session manual task above for that question.

Start with one smoke repeat. After correcting harness/setup issues, use matching repeated tasks to estimate outcome variability. Preserve old outcomes and increment the experiment version for a changed fixture, oracle, rubric or intervention. Report pass/planned, failed, inconclusive and not-run counts, plus observed tokens, elapsed time and interventions. Missing cost stays unknown. Wider trials require an explicit useful budget; no model calls run in deterministic CI.

## Blinded craftsmanship review

Give a fresh reviewer the exported anonymized source/diff packet and the [quality rubric](../skills/code-review/references/quality-rubric.md). Keep the mapping to candidates/models private until it has recorded its assessment. Do not supply author scores or behavioral acceptance results before its initial code assessment. Predeclare the reviewer qualification rule and minimum calibration coverage before seeing candidate grades. Failed or insufficient calibration keeps quality unassessed. Calibrate the reviewer using [the calibration controls](../evals/agent-quality/calibration.md); those controls require owner adjudication before a grade is trusted.

Score types/boundaries, ownership/effects, simplicity/readability, test strength and changeability separately, with source/check evidence and justified not-applicable dimensions. Correctness and permissions remain hard gates. Record usefulness and your interventions separately. Quality stays unassessed until a calibrated independent review exists.

## Adoption decision and retained evidence

Retain the candidate/plugin digest, fixture/oracle digest, host/model/settings, actual source revision and dirty digest, original requests, every attempted result, first failures, reports/artifact hashes, review rubric/grader version, interventions and your manual observations. Keep raw runner trees ignored; commit concise lasting evidence and useful sanitized media. The [implementation record](../.astack/reliability/behavior-contract.md) distinguishes what the maintainer exercised from the owner acceptance still to run.

Proceed with a pilot when the intended package loaded, material behavior passes independent checks, manual browser paths work, and confirmed review findings are resolved. A failed hard gate blocks adoption of that result. Setup/capture gaps remain inconclusive. A smoke tie means no demonstrated advantage; promote an improvement claim only with comparable repeated evidence, useful quality review and acceptable owner effort.
