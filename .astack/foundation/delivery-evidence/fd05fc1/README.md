# Incomplete repaired delivery trial

Candidate **`fd05fc1b3c2f0f7aafbc638efc37f20f6d5b3105`** ran two independent rounds concurrently with the unchanged rubric `8aa129b3809a7e2da895c0d51fb16e3dac8194b2f57d59290974a41068ea6bdb`. Codex CLI `0.160.0` used configured `gpt-6.1-sol` with `ultra` reasoning; Bun was `1.4.0`, Node `24.19.0`, on Darwin arm64. Delivery used explicit `danger-full-access`; reviewers used `read-only`. [The compact summary](summary.json) records candidate/plugin/harness identities, exact observed usage, durations, scores and interventions. Monetary cost is unavailable and remains null.

**Four of six stages completed and passed. The full trial remains inconclusive.**

| Round | Creation | Title editing | Seeded bug fix |
| --- | --- | --- | --- |
| 1 | Pass, 12/12 | Pass, 12/12 | Delivery not started; seed preflight inconclusive |
| 2 | Pass, 11/12 | Pass, 12/12 | Delivery not started; seed preflight inconclusive |

Trusted running-product acceptance passed for all four completed deliveries, including independent persisted reads, web/MCP title updates and explicit invalid-title/ownership denials. Both bug preflights passed R1/R2, then timed out waiting for the Reopen button. R3 was recorded **inconclusive**, not the explicit persisted-status failure required to accept the seed. No bug-delivery or bug-review agent started. The runner exited 1; its original report and scores are preserved.

**Historical R4 coverage correction:** the original reports overstate second-user MCP reads. They checked another user's Convex read isolation and MCP mutation denial, but did not call MCP list as that second user. The second creation reviewer identified that overstatement and scored accurate-result 1, producing 11/12. Original observations/scores remain unchanged; R4 does not establish that additional read case. Live WorkOS and installed ChatGPT also remain unverified.

Two read-only supplemental collectors retained lifecycle evidence outside app/ and explicitly normalized UTF-8 terminal logs that the candidate's binary-control policy omitted. All six stage folders were observed. Both collectors recorded **observer-error** when recursive cleanup removed their candidate marker; those original statuses/timestamps remain intact. Subsequent checks confirmed owned temporary checkout, candidate plugin cache and observer PIDs were absent. Two automated collection records were appended to `interventions.harness`; human intervention remains **none, count 0**. Collection did not steer agents, replace checks or alter scores.

Supplemental latest/version hashes all verified. Polling snapshots are not atomic final source attestations: the round-2 feature's last observed source hash differs from its canonical accepted input. Reconstructing each completed stage's original source digest from its original-file manifest matches all four canonical accepted digests. Every retained file matches its declared exported hash, and 222 retained TypeScript files parse. Source credential redaction intentionally changes some bytes; transformations and omissions remain explicit. This archive does not promise complete source replay.

[raw-evidence.zip](raw-evidence.zip) preserves all **1004** existing raw/supplemental artifacts, including canonical reports/prompts/JSONL, both seed-before failures and interrupted snapshots, acceptance screenshots, source/diff provenance, observer scripts and all observed versions. The public export sanitizes personal/root temporary prefixes and their escaped host-user representations only; all other existing retained bytes are preserved. All 86 PNGs remain byte-exact. [The TSV manifest](raw-evidence.files.tsv) records original/exported hashes, sizes, source-relative provenance and transformation flags. Originals remain under workspace-relative `examples/foundation/.proof/delivery-fd05fc1-repaired`.

Scanning 918 UTF-8 artifacts and 86 PNGs found no private-key blocks, signed JWT patterns, provider-key patterns or literal bearer credentials. Sixteen broad credential-assignment matches are existing redaction markers in known sanitized unit-test fixtures/diffs; their raw count is retained rather than called zero. The export contains zero matching user/randomized temporary prefixes. These are bounded observations, not a guarantee of detecting every possible secret.

The ZIP has **5049353 bytes** and SHA-256 **`b7dfca023777c5838205760852c0e40621efc3c0ff89b26313d9730304ed47ba`**. Sorted relative paths, fixed 1980 timestamps, regular-file permissions and DEFLATE level 9 produced identical bytes twice. Every entry hash was verified and local original hashes were rechecked unchanged during curation. Verify [the checksum](raw-evidence.zip.sha256), then extract into a new directory:

```sh
shasum -a 256 -c raw-evidence.zip.sha256
unzip raw-evidence.zip -d /absolute/path/to/new-repaired-trial-evidence-directory
```
