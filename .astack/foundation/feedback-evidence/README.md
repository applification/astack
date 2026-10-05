# Feedback evidence

The four [summaries](summaries/) and [cache comparison](cache-comparison.json) are compact derivatives of the original reports. They retain the original pass/fail outcomes, source revision and digest, available post-scaffold fingerprint, lock and manifest digests, candidate overlay contents and digest, check details, selected command timings and failure coverage. A null post-scaffold fingerprint means that the original run did not collect it. The exact root manifests and every command observation remain in the original reports inside the archive.

[raw-evidence.zip](raw-evidence.zip) preserves all 126 original files from commit `baa74729f5c2b120be549d82177a92ca0ee9d41e` without rewriting their bytes. [raw-evidence.files.tsv](raw-evidence.files.tsv) lists every archived path, byte count and SHA-256. [raw-evidence.zip.sha256](raw-evidence.zip.sha256) records archive SHA-256 `9c2d690e7c5228eae6b464291d804fe1608908eafb91d552dbe11e4d20a0f88c`. The archive is 269457 bytes.

The ZIP uses sorted relative paths, stored file bytes, a fixed 1980-01-01 timestamp and fixed regular-file permissions. Creating it twice produced identical bytes. Every extracted entry was checked against the original retained file and its Git blob at the source commit. An ignored local copy remains at `.proof/feedback-evidence` in the curating checkout; the tracked archive is the portable copy.

Before archiving, the retained text was checked for personal filesystem paths, unredacted JWT/bearer values and credential assignments. None were found. All retained Turbo summaries have empty configured/inferred/passthrough environment values. No authentication or backend operation was performed during curation.

Verify and extract into a new directory:

```sh
shasum -a 256 -c raw-evidence.zip.sha256
unzip raw-evidence.zip -d /absolute/path/to/new-raw-evidence-directory
```

Each compact summary names its original report entry in the archive. The exact manifest is the `manifest` field of that original report. Original run directories preserve the first cache failure, the sign-in callback lint failure, the successful explicit-config candidate and the later cache diagnostic with its separate root-tooling lint failure.

## Key logs

- [Shared UI affected coverage](key-logs/affected-shared-ui.log)
- [Intended floating-promise diagnostic](key-logs/quick-floating-promise.log)
- [Installed hook hiding and restoring unstaged changes](key-logs/partial-stage-commit.log)
- [Committed valid staged source](key-logs/partial-stage-committed-source.log)
- [Preserved unstaged diff](key-logs/partial-stage-unstaged-diff.log)
- [Preserved invalid unstaged lines still fail quick feedback](key-logs/partial-stage-remaining-invalid-feedback.log)
- [Installed hook rejecting staged invalid code](key-logs/staged-floating-commit-rejected.log)
- [HEAD before rejection](key-logs/staged-failure-head-before.log), [HEAD after rejection](key-logs/staged-failure-head-after.log)
- [Retained staged diff after rejection](key-logs/staged-failure-retained-diff.log)

These selected logs are also verbatim copies of their entries under `2026-10-04-candidate/` in the raw archive.
