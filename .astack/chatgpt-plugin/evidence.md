# ChatGPT plugin support evidence

Implementation revision: `e87b9046d8fb58e7cfd02d0d99fa1da549833532`, branch `codex/chatgpt-plugin-support`, based on `cee59e2087dab0908e7828be2f641a763dbe2515`. This evidence file is a documentation-only follow-up to that revision. Checked 2026-09-30 on macOS arm64, Node 25.8.2, Bun 1.4.0 and Python 3.13. CI additionally targets Node 22; its result is separate from these local observations.

## Observed results

| Contract | Result | Evidence and practical limit |
| --- | --- | --- |
| A1 portable astack package | Pass | Offline Agent Plugins 1.0.0 schemas validate root plugin.json/mcp.json; package paths, skill discovery and marketplace identity resolve. Legacy fallback is removed. Three validator tests cover identity, fallback rejection and missing executable assets. Installed client loading remains unverified. |
| A2 guidance and routing | Pass for static checks; live activation skipped | skill-creator quick_validate reports valid. The entry skill routes plugin work to six focused references, including the compatibility ledger. All 47 routing examples and site scenarios match, including ten new plugin cases. No live-model evaluation or installed skill activation was run. |
| A3 reference UI profile | Pass locally; host integration skipped | A real legacy MCP client discovers/calls entrypoint, data, settings and mention tools and reads bundled HTML with the MCP Apps media type. Real Node settings survive a relocated process restart. Storybook builds and its normal/selected/empty/error states render; clicking beta changes the pressed state. Adapter tests preserve local selection through unrelated host updates and retain dirty drafts. ChatGPT bridge, navigation, file permissions and optional host messaging remain unverified. |
| A4 separate MCP 2.0 profile | Pass locally; ChatGPT lifecycle skipped | A real v2 client completes MRTR accept/cancel; raw HTTP discovers events, returns input_required, completes retry and rejects invalid accepted data. Signed receiver checks exact payload bytes, stable retry IDs, changed timestamps and dual-key rotation. Lifecycle checks cover persistence, identity refresh, filtering, unsubscribe, expiry, callback errors -32015, terminal statuses and emission during delivery. Private destination checks reject local URLs. Actual ChatGPT callback receipt/action, public DNS/TLS delivery, revocation and batching remain unverified. |
| A5 portable reference artifact | Pass locally; installation skipped | The entire build is copied to a temporary directory without source files or node_modules. Both scripts run under Node through real stdio clients. An exclusive lock prevents concurrent owners; stale locks require explicit recovery. The delivery worker belongs to the server process, and clean shutdown releases ownership. HTTP runs on loopback, rejects missing bearer auth and browser Origins, and returns modern discovery to authenticated requests. Local marketplace/registered connection/tunnel installation instructions are provided but were not executed against a test account. |
| A6 docs, site and CI | Pass locally; remote CI separate | Root/site/schema checks pass and repository source links exist. Browser inspection of the added site section shows the guidance and links in the existing layout. CI covers frozen installs, validators, builds, strict types, client/lifecycle/relocation tests and Storybook; Pages deployment depends on these checks. |

## Checks

- Root: `bun install --frozen-lockfile`, `bun run check`, `bun test scripts`, `git diff --check`: pass. Three validator tests; 47 matching route examples.
- Example: `bun install --frozen-lockfile`, `bun run build`, `bun run typecheck`, `bun test`: pass. Fifteen tests, 90 assertions, including copied Node stdio processes and a running authenticated HTTP server.
- `STORYBOOK_DISABLE_TELEMETRY=1 bun run build:storybook`: pass; the ordinary Storybook preview bundle has a non-fatal size warning.
- `bun scripts/check-plugins.ts examples/chatgpt-plugin/dist/plugin`: portable artifact passes. The build includes repository and installed-dependency license notices.
- Bundled skill-creator `quick_validate.py`: pass using a temporary Python virtual environment with PyYAML. No project Python dependency was introduced.
- Independent review: all confirmed findings resolved, including process ownership, navigation resets, draft preservation, callback errors and stale-lock recovery. No Convex code is present, so its specialist review is not applicable.

## Retained media

[Shared component selection](media/storybook-selection.jpg) shows beta selected after a browser click in the normal story. [Site plugin guidance](media/site-plugins.jpg) shows the new section in the existing site layout. These are presentation observations; neither is evidence of an installed ChatGPT integration.

## Remaining host proof

The PR remains draft pending installed-client proof where the capability is claimed: portable astack loading and reference skill activation, ChatGPT supported entrypoints/links/settings/mentions/files/context, registered MRTR forms, and user-authorized events reaching the subscribed chat and triggering the requested response. Account/workspace identity, host version, real connection ID, tunnel credentials and OAuth need an actual configured test environment. The fixture uses a fixed development persona and a single-owner file store; production account isolation, transactional storage and distributed leases are outside its scope.

The released helper profile is intentionally separate from MCP 2.0. No combined helper/MRTR compatibility, MCP Jam host equivalence, mobile support, public submission readiness or Loami integration is claimed. Retest SDK boundaries when the published peers or host contract changes.

## Routing example clarification

The follow-up to `1899d89` names the existing cases explicitly: “Add OpenAI plugin extensions for a ChatGPT sidebar and conversation panel” and “Build an MCP App using our shared React UI components”. Both keep the Feature route and now state the specialized references to load. The picker searches request text; explicit names make these examples discoverable by the product terms.

`bun run check` and `git diff --check` pass for this clarification; all 47 examples still match. In the running website at localhost:6027, searching each term returns its example, and selecting it shows ROUTE 01 / FEATURE with the expected guidance. [MCP App routing](media/routing-mcp-app.jpg) and [OpenAI extensions routing](media/routing-openai-extensions.jpg) retain those observations. This proves the site's expected-route display, not a live agent routing evaluation. No runtime server or UI adapter code changed.
