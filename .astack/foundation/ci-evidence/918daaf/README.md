# Linux foundation CI evidence

[GitHub run 37243710891](https://github.com/applification/astack/actions/runs/37243710891) passed for head `918daaf7680ae5c53b46d0c9db6fe87bab0857ec`. The [reference job](https://github.com/applification/astack/actions/runs/37243710891/job/111557334294) ran from 2026-10-04 23:25:39 UTC to 23:27:23 UTC (104 seconds). Its checkout was the PR merge revision `122e31c02ac6f9732dc1a2b8befb8af7dfe0ff3c`; head and running-product identity are recorded separately in [the compact derivative](report.json).

The job created a fresh independent scaffold, installed the frozen lockfile and Chromium, then passed formatting, typed lint, strict types, **28 tests / 410 expect calls**, web/MCP UI/Storybook builds and **15 enforcement probes**. `check:ci` reported 21525 ms. Observed versions were Node `v24.21.0`, Bun `1.4.0+34cbb9a40`, TypeScript compiler `7.0.2`, compiler API `6.0.3`, ESLint `9.39.4`, Vite `8.3.2`, Storybook `10.6.1` and Chromium `153.0.8010.12` (Playwright build 1243), on Ubuntu 24.04 x64. Test assertion counts describe this fresh scaffold; root evidence inventories can produce a different count.

Local Convex + Vite + Chromium readiness passed **R1–R8** and completed cleanup. Host evidence records two mounts, two teardown acknowledgements, four closed owned connections and zero uncaught App errors. The actual build identifier is **`unversioned@sha256-54e77c5bc7d64635e4e4afc2c0b8bb7a820c3ad0b469a07aae262ed6919afa45`**, which matches the enforcement input digest. The independent scaffold has no Git checkout, so the report uses `unversioned` with its exact measured digest. No commit prefix is substituted. **G1 live WorkOS and G2 installed ChatGPT remain skipped.**

[raw-evidence.zip](raw-evidence.zip) contains all six downloaded artifact files plus the original job log as a path-sanitized export. Only the log required transformation: its 17 filesystem runner-prefix references were replaced in the exported UTF-8 copy. Terminal formatting and all other existing bytes remain unchanged; both PNGs remain byte-exact and show synthetic proof data. Local originals remain untouched under the workspace-relative `examples/foundation/.proof/ci-linux-918daaf`. [The compact TSV manifest](raw-evidence.files.tsv) records source-relative provenance, original/exported hashes and sizes, and each transformation flag.

The seven-file scan found zero private-key blocks, signed JWT patterns, provider-key patterns, literal bearer credentials or credential assignments. Exported files contain zero matching user or randomized macOS temporary prefixes. These are bounded observations, not a guarantee that every possible secret can be detected.

The ZIP has **194472 bytes** and SHA-256 **`0615ec83d4707f92bd4cfb4e740eeaab5393986e3bce410d2d05dca32d5f2d86`**. Sorted paths, fixed 1980 timestamps, regular-file permissions and stored bytes produced identical archives twice. Every entry was verified against its exported hash, and all original hashes were rechecked unchanged. Verify [the archive checksum](raw-evidence.zip.sha256) before extracting into a new directory:

```sh
shasum -a 256 -c raw-evidence.zip.sha256
unzip raw-evidence.zip -d /absolute/path/to/new-linux-ci-evidence-directory
```
