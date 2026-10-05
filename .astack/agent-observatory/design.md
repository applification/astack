# Observatory visual direction and proof scope

The initial contract selected an Astack companion with a dark navigation rail, light workspace, restrained blue primary actions, green/red status accents, and a trace with expandable native-order rows. Work, Runs, Skills & workflows, Problems and Capture health are primary destinations. Counts distinguish loaded pages from global version aggregates. Missing timing, unknown work outcome and withheld content are visible states, not fabricated values.

The owner's appearance refinement replaces that rail with the public [Astack site's](https://astack.applification.net) compact header, slate palette, Newsreader headings, Geist body, IBM Plex Mono labels, fine rules and pill controls. Light and dark roles were read from the rendered reference before implementation. The dashboard uses a smaller heading scale to keep data useful; filters, tables and native-order trace behavior remain intact. Fonts are self-hosted in the bundle. System/Light/Dark is available before sign-in and across authenticated views, with only the non-sensitive preference persisted.

Compared real fixture renders with the live reference in both themes: matching surface/text/link roles, type families and header treatment were observed. Four deterministic Storybook tests passed, including reload persistence and narrow light/dark views. Browser media emulation independently confirmed that System changed from light to dark and back in response to actual `prefers-color-scheme` changes; the override was reset afterward. This is browser/reference comparison, not a Pen-frame comparison.

The initial Pen exploration named “01 Observatory · runs” and “02 Run · trace” before production wiring. The Pen connection points at a removed foundation checkout and ignores the requested local file path: no `.pen` artifact was saved in this worktree, and its screenshots were blank. The Pen comparison is **unverified**, not a passing design check. Do not infer a portable design artifact from the canvas tool responses.

Production tokens live in `packages/ui/src/styles.css`. Storybook renders the production presentation with synthetic props:

| Story | Covered state |
| --- | --- |
| `observatory-runs--mixed` | Navigation, status, machine/work context, desktop/narrow table |
| `observatory-trace--mixed` | Expanded failed result, filtering failures/interventions, unknown timestamps |
| `observatory-trace--empty` | No captured events |
| `observatory-trace--failure` | Failure visibility |
| `observatory-trace--missing-time-and-privacy` | Withheld payloads and observation-time hashes |

Retained [light runs](evidence/runs-mixed.png), [dark runs](evidence/runs-dark.png), [narrow light](evidence/runs-narrow.png), [narrow dark](evidence/runs-narrow-dark.png), [light trace](evidence/trace-failure-expanded.png) and [dark trace](evidence/trace-failure-dark.png) are actual browser captures of synthetic stories. The live deployment has separate authenticated browser proof; private telemetry pixels were not retained publicly. The draft PR names the original Pen artifact/comparison gap.
