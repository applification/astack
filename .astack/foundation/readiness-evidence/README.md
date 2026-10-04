# Independent local readiness evidence

Independent review reported no actionable findings at commit `baa74729f5c2b120be549d82177a92ca0ee9d41e`. [The retained readiness report](report.json) identifies that commit and foundation source digest `ab3aad4cc7d5b3bb23c64748abbe1d649efd50ffcfd4aee2fdf521662fc72e6e`. This is local acceptance evidence for the foundation profile.

R1–R8 passed against an isolated local Convex deployment, disposable signed RS256 identities, Vite, Chromium and the standard AppBridge host. The checks cover running revision identity, independent persisted reads after web and MCP actions, owner isolation, invalid credentials and arguments, self-contained resource packaging, host styles/remount/teardown and runtime errors. Cleanup is recorded as complete.

G1 remains skipped: live WorkOS sign-in, refresh and organization lifecycle were not exercised. G2 remains skipped: installed ChatGPT OAuth, tool selection and UI behavior were not exercised.

[Host observations](mcp-host-observations.json) record two mounts, two teardown acknowledgements, four closed owned connections and no uncaught App errors. The browser's 405 messages are expected responses to unsupported SSE GET requests on this stateless JSON transport; aborted requests accompany owned connection teardown. These messages are retained separately from uncaught App errors.

The [web screenshot](web-persisted.png) and [MCP App screenshot](mcp-app-host.png) show the same synthetic persisted work item. They contain no personal account data or credentials.

[raw-evidence.zip](raw-evidence.zip) preserves the five independent readiness originals and the separate enforcement report without rewriting their bytes. Archive entries retain the `independent-review-baa7472/` and `enforcement/` prefixes. The original `runtime.log` remains in the archive. [The per-file manifest](raw-evidence.files.tsv) records all six paths, byte counts and SHA-256 digests; [the archive checksum](raw-evidence.zip.sha256) records SHA-256 `19c1f636922855043b7477ab2865a2629614c2bcdcb31b362998de0cf20ac049` for the 79500-byte ZIP.

The ZIP uses sorted relative paths, stored bytes, a fixed 1980-01-01 timestamp and fixed regular-file permissions. Creating it twice produced identical bytes, and every entry was checked against its original. Readable reports and screenshots here are verbatim copies of their archive entries. Text and screenshot inspection found no credentials or personal filesystem paths. No backend or authentication action was performed while curating these files.

Verify and extract into a new directory:

```sh
shasum -a 256 -c raw-evidence.zip.sha256
unzip raw-evidence.zip -d /absolute/path/to/new-readiness-evidence-directory
```

[The earlier enforcement report](enforcement-report.json) passes its fifteen detectable-rule probes. Its input digest is `762c137daac88fec70e478d8ecef72402a744d56498e4c8eac94a11a40f730ca`, which differs from the readiness candidate digest. That probe ran before the subsequent CSS and lifecycle changes; it is retained as evidence for its recorded input rather than a new run against `baa7472`. Semantic composition and test quality still require review.
