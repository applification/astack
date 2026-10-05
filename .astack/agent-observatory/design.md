# Observatory visual direction and proof scope

The initial contract selected an Astack companion with a dark navigation rail, light workspace, restrained blue primary actions, green/red status accents, and a trace with expandable native-order rows. Work, Runs, Skills & workflows, Problems and Capture health are primary destinations. Counts distinguish loaded pages from global version aggregates. Missing timing, unknown work outcome and withheld content are visible states, not fabricated values.

The initial Pen exploration named “01 Observatory · runs” and “02 Run · trace” before production wiring. The Pen connection points at a removed foundation checkout and ignores the requested local file path: no `.pen` artifact was saved in this worktree, and its screenshots were blank. The Pen comparison is **unverified**, not a passing design check. Do not infer a portable design artifact from the canvas tool responses.

Production tokens live in `packages/ui/src/styles.css`. Storybook renders the production presentation with synthetic props:

| Story | Covered state |
| --- | --- |
| `observatory-runs--mixed` | Navigation, status, machine/work context, desktop/narrow table |
| `observatory-trace--mixed` | Expanded failed result, filtering failures/interventions, unknown timestamps |
| `observatory-trace--empty` | No captured events |
| `observatory-trace--failure` | Failure visibility |
| `observatory-trace--missing-time-and-privacy` | Withheld payloads and observation-time hashes |

Retained [runs](evidence/runs-mixed.png), [narrow runs](evidence/runs-narrow.png) and [trace](evidence/trace-failure-expanded.png) are actual browser captures of synthetic stories. The live deployment has separate authenticated browser proof; private telemetry pixels were not retained publicly. The draft PR names the remaining Pen artifact/comparison gap.
