# Historical delivery attempt

The [first-attempt summary](baa7472-summary.json) records candidate `baa74729f5c2b120be549d82177a92ca0ee9d41e`, configured model `gpt-6.1-sol` with `ultra` reasoning, Codex CLI `0.160.0`, Bun `1.4.0` and Node `24.19.0` on Darwin arm64. The delivery shell selected Node `24.21.0`. Delivery used `workspace-write`; the independent reviewer used `read-only`. Installed plugin digest: `b35a05602dac11476d6c8b9df067fabfaef2b02d5ecb8b497ee2ff4c3e82ea6a`. Unchanged rubric digest: `8aa129b3809a7e2da895c0d51fb16e3dac8194b2f57d59290974a41068ea6bdb`.

Only the first creation stage completed out of six intended stages across two rounds. Delivery returned **partial**, its independent score was **10/12**, and its delivery gate failed. Separate trusted product acceptance passed R1–R8 against the delivered source. Preparing the feature stage failed at its first installed-hook commit; no feature delivery agent started. The overall attempt remains **inconclusive**. Original token usage and interventions are retained; monetary cost is unavailable and stays null. Live WorkOS and installed ChatGPT remain unverified.

Historical coverage correction: these original R4 observations overstate second-user MCP read coverage. The verifier checked another user's Convex read isolation and MCP mutation denial, but did not call MCP list as that second user. Original reports and scores remain unchanged; their R4 pass does not establish that additional read case.

[baa7472-raw.zip](baa7472-raw.zip) exports all **221 historical artifacts**, including prompts, JSONL, reviewer findings, product acceptance/screenshots, command logs, creation source and the interrupted feature snapshot. This is a **sanitized export**, with filesystem user and randomized macOS temporary prefixes replaced in UTF-8 copies. The original records under the workspace-relative `examples/foundation/.proof/delivery-baa7472` remain untouched. The summary's original-record hashes continue to identify those local originals. [The export manifest](baa7472-raw.manifest.json) records provenance and [the compact file index](baa7472-raw.files.tsv) records every source-relative path, original SHA-256, exported SHA-256 and applied transformation. Binary PNGs remain byte-exact.

The known old source-retention corruption is deliberately preserved. The original creation source manifest disagrees with five retained files; the interrupted feature manifest disagrees with four. Exporting these observed artifacts does not make either project a valid replay snapshot or change the original score. The manifest retains both historical pre-redaction hashes and observed original retained hashes for those mismatches. New path sanitization is tracked separately.

The credential-pattern scan covered 219 UTF-8 files and 2 PNGs (2443413 original bytes). It found zero private-key blocks, signed JWT patterns, provider-key patterns, literal bearer credentials or credential assignments in original or exported artifacts. The PNGs show synthetic proof data. Original text contained 272 personal filesystem-prefix references and 202 randomized macOS temporary-prefix references; the export contains zero matches for those patterns. These are bounded scan observations, not a guarantee that every possible secret can be detected.

The archive has **841099 bytes** and SHA-256 **`4b0697c76b31bb4d3cab56e89053af37e174545145c8e6e3f4c970e93763c867`**. It uses sorted relative paths, fixed 1980 timestamps, fixed regular-file permissions and DEFLATE level 9. Two builds in the same environment produced identical bytes. Every archive entry was checked against its exported hash, and every original was rechecked unchanged. [The archive checksum](baa7472-raw.zip.sha256) supports verification:

```sh
shasum -a 256 -c baa7472-raw.zip.sha256
unzip baa7472-raw.zip -d /absolute/path/to/new-historical-trial-directory
```
