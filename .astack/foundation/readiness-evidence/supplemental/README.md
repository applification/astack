# Supplementary historical readiness records

This archive preserves seven earlier local runtime/control attempts and the ignored copy of the isolated domain TSX enforcement result before their worktree is archived. It records historical observations; exporting did not run another acceptance check. [The summary](summary.json) retains each exact reported build identity, time, case result and cleanup status. Original files remain untouched.

| Record | Original reported outcome | Interpretation and limit |
| --- | --- | --- |
| integration-first | fail | R7 stopped after a 30-second host connection wait. This is inconclusive about host product behavior; the later attempt remains separate. |
| integration-second | pass | Historical local R1–R8 observation with the same original dirty build label. |
| integration-strict-denials | pass | Historical local R1–R8 observation at its recorded source digest. |
| integration-status-roundtrip | pass | Historical web/MCP status roundtrip at its recorded source digest. |
| host-styles-teardown-first | pass | Historical host style/lifecycle observation at its recorded source digest. |
| host-styles-teardown-final | pass | Separate historical host style/lifecycle observation at its recorded source digest. |
| title-edit-missing-feature-control | fail | Expected F0 control failure: requested title-edit tool absent. It establishes the negative control, not a delivered feature. |
| enforcement/report.json | pass | All 17 probes pass with input digest `ede5bc2ce0b3b684805e0812795415d845bab5add98d891bc744f7fac3e8a76b`; [the domain TSX repair](../../repair-evidence/domain-tsx/README.md) retains the separate source and repair. |

**Historical R4 coverage correction:** these seven runtime reports predate the actual second-user MCP list check. They checked another user's Convex read isolation and MCP mutation denial, but their original R4 text overstates the additional MCP read case. Original reports are preserved without score/outcome rewriting. The repaired R4 proof is recorded [separately](../../repair-evidence/r4-mcp-read-isolation/README.md). R8 and external gaps are absent from the first failed report; later title-edit cases are absent after the F0 control failure. Absent checks are not passes.

The [deterministic ZIP](raw-evidence.zip) contains all 30 original files: 17 UTF-8 records and 13 PNG screenshots. Each export is byte-exact to its already-sanitized original, with original/export SHA-256, lengths and explicit unchanged transformation flags in [the per-file index](raw-evidence.files.tsv), plus [the archive checksum](raw-evidence.zip.sha256). PNG signatures were checked; screenshots use synthetic local work-item data. The existing `redactTrial` sanitizer, terminal-control and host-path normalization required no additional changes. Bounded scans found zero actual JWT/private-key/Bearer/key-assignment syntax or user/temporary paths. This is not an exhaustive semantic privacy proof.

All seven runtime reports record cleanup complete. G1 live WorkOS and G2 installed ChatGPT remain skipped where recorded. Complete original source snapshots are unavailable in these seven folders, and the early dirty label is not a full source digest. This archive makes no source replay, final-head readiness or broader delivery-trust claim.

An independent read-only review verified the 30-entry inventory, source/export digests and lengths, ZIP metadata and two byte-identical rebuilds, valid PNG chunk CRCs without text metadata, bounded privacy scans and the historical claim limits. It reported no corrections. This review did not perform screenshot OCR.
