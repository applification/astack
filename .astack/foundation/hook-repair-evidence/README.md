# Git hook repair proof

Eight disposable integration cases passed. Standalone and nested first commits executed installed hooks with checked-in Convex generated types and absent embedded MCP output. The nested project path contains spaces. No commit used a hook bypass.

| Case                                                             | Result |
| ---------------------------------------------------------------- | ------ |
| Standalone first commit, partial staging and staged rejection    | Pass   |
| Nested first commit, partial staging and staged rejection        | Pass   |
| Preserve existing default hooks                                  | Pass   |
| Preserve configured hooks; explicit replacement                  | Pass   |
| Preserve enclosing repository with indexed owner files           | Pass   |
| Preserve enclosing repository with untracked owner files         | Pass   |
| Failed replacement restores default hooks and their execution    | Pass   |
| Failed replacement restores configured hooks and their execution | Pass   |

The first commits took 10.7 seconds each. Partial MCP UI commits took 3.9 and 4.0 seconds: valid staged source built successfully while deliberately invalid unstaged syntax survived byte-for-byte. Staged floating promises were rejected by the expected ESLint rule in 1.6 seconds; HEAD and staged edits were preserved. Failed shim provisioning returned failure and a later actual commit executed the previous hook. Independent review found no remaining actionable defects and additionally checked inherited/global and multiple local hook values.

[report.json](report.json) is a compact derivative of the final runner report. [input.json](input.json) records base revision `3d90cfb38038bf9374dbe46f1bf1d09c4d3f09ed` and the exact hook source overlay; every fixture had profile digest `146d2c8a7abbe9774b8e169b2073007c5bcc7ea6c9d4d4734cf41c9c456bec46`. This focused run precedes the later integrated candidate with scaffold/harness repairs. It is separate from runtime, live WorkOS and installed ChatGPT proof.

[first-failures.json](first-failures.json) preserves the original `baa7472` trial's nested-hook finding and next-stage initial-commit failure, plus the repair review's provisioning and inventory findings. The original delivery remains partial, its gate remains failed and its score remains 10/12. Passing repair fixtures do not change that result.

[raw-evidence.zip](raw-evidence.zip) contains the original sanitized first/final hook-probe reports and command logs verbatim, the focused first-failure extracts, and a complete 73-file input source manifest. The first hook probe passed four cases before the independent review added the enclosing-repository and failure-recovery cases. Logs were sanitized when captured; source files were not rewritten for this archive. [archive-manifest.json](archive-manifest.json) and [raw-evidence.sha256](raw-evidence.sha256) verify its deterministic bytes. The credential/personal-path scan passed. Owned temporary fixtures were removed.

To repeat against the current source in a new evidence directory:

```sh
bun scripts/prove-foundation-hooks.ts "$PWD" /tmp/astack-hook-evidence-new
```

The runner creates fresh projects, installs with the frozen lockfile, initializes Git with fixture-local identities, executes actual commits and cleans up its owned temporary directories. It isolates host Git configuration to keep the result reproducible.
