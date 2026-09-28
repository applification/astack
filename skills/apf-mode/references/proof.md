# Proof

Proof is a claim about an observable result on a named revision and environment. Select it from the change contract and the project's actual surfaces. AStack does not supply a universal driver; use the project's working commands or build a small repeatable lever when the same manual sequence would otherwise recur.

## Select

For each acceptance case, identify the cheapest check that can catch its failure and whether a running-product observation is needed. Select surfaces by behavior and dependency impact: a backend change can affect web or MCP without touching either client, while a web-only copy change normally needs no MCP run. State the reason for each applicable or excluded surface.

Use component stories for rendering and interaction states, tests for focused domain and protocol behavior, and real-app driving for end-to-end state, identity, timing, or integration claims. A visual result cannot establish persistence; a mocked callback cannot establish an authorized server write. Do not demand video or full-suite runs for every case when a narrower check proves it.

## Run

Before driving an instance, establish that it is the intended build and environment with disposable or authorized fixtures. Do not infer this from an open port alone. Record the full commit, build or deployment identity where relevant, surface, actor or test persona, action, expected observation, and actual observation. Confirm material mutations with a fresh read or independent view. Keep secrets and credentials out of evidence.

Use these outcomes consistently:

- `pass`: the named check observed the expected behavior on the named target.
- `fail`: it observed contrary behavior.
- `inconclusive`: setup or observation could not distinguish pass from fail.
- `skipped`: applicable but not run, with a reason.
- `not applicable`: behavior cannot be reached from that surface, with a reason.

Preserve the first failure when rerunning. Cleanup stops what the run started and removes disposable state; it does not erase evidence needed to explain a failure. Publish a concise proof result and useful media to the PR when one exists. A later code change invalidates proof for behavior it could affect until the new revision is checked.
