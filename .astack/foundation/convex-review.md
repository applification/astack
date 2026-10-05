# Convex reviewer pass

Reviewed on 5 October 2026 at 00:36 UTC by `/root/completion_audit`, a read-only agent independent of the backend implementation. This is a new pass using `convex:convex-reviewer`; it does not relabel the earlier generic review. The skill was read from `convex/2.0.1/skills/convex-reviewer/SKILL.md` before examining the code. Skill file SHA-256: `fbba669ed505b5c09d14c3ab40ae0de5e2483bb0334a0e0d8ecf27c4d7305927`.

Candidate: `2a973c5aa556953db48b2a3104754de54c31f4e5`. All 19 tracked backend/configuration/generated-type and web/domain adapter files below were compared byte-for-byte with `git show <candidate>:<path>` and match. The profile source digest for this candidate is separately recorded as `84455f625e2c41166d0ff4b80592d3a35fa30ff5bd69c3c1edc8a31b6490f52c`. Later root evidence/documentation commits do not change these reviewed files. The isolated domain TSX lint repair also changes neither this backend nor the adapter code.

No actionable finding remains in the reviewed scope. No repository or live-trial files were changed, and this review did not launch another runtime.

## Checklist observations

| Skill area | Observation |
| --- | --- |
| Authentication | Every public data query/mutation calls `requireUser(ctx.auth)`. It obtains Convex's validated identity, requires a nonempty subject and accepts WorkOS `user_` subjects outside local proof mode. Client input cannot set the owner. MCP first requires the validated identity, then checks the same Bearer's issuer, subject and resource audience before dispatch. Public health and OAuth metadata intentionally expose no owned data. |
| Authorization | Owner identity is the validated subject, never email or a supplied user ID. `list` restricts its indexed query to that owner. Status and deletion fetch by validated Convex ID and compare the document owner before writing. Missing and foreign documents use the same denial. The profile has no team/organization permission model or admin bypass. |
| Validation | Every exported data query/mutation has object-form `args` and `returns` validators. Status is a literal union; identifiers use `v.id` at writes. Creation also applies the shared nonempty/160-character title schema. HTTP actions use native Request/Response contracts and SDK/Zod parsing, rather than query/mutation argument validators. The MCP adapter's branded-ID assertion is documented as compile-time restoration; the receiving mutation still performs runtime ID validation. |
| Public/internal scope | No scheduler, cron or privileged internal operation is introduced. MCP `runQuery`/`runMutation` calls target the same public authenticated operations; ownership checks remain at those operations. The local proof configuration requires explicit mode, loopback deployment/issuer/resource and inline public JWKS. Unconfigured authentication has no provider fallback. |
| Indexes and loading | The owner field has `by_owner`. Listing uses that index and `take(100)`, with no database `.filter` or unbounded `.collect`. MCP explicitly describes this as the 100 most recent items. Document-ID lookups are direct; no relationship scan or redundant compound index is introduced. Broader pagination is outside this bounded reference behavior. |
| Reactivity and transactions | Queries are deterministic and do not use `Date.now`. Web server data remains in native Convex subscriptions; the route owns only the URL filter. Status/delete operations recheck the owner and write within the mutation transaction. MCP actions do not duplicate the database state or forward the incoming bearer to another service. |
| Schema | Documents are flat, with validated title/owner strings and a closed status union. No nested or growing document arrays are introduced. Convex IDs and generated types define database references. |
| Async and error handling | Data calls are awaited. The MCP request creates and closes its own stateless SDK server in `finally`, returning JSON responses and authenticated 405s for unsupported stream/session methods. Web auth/data adapters gate protected reads on Convex authentication state and preserve drafts while surfacing submission failures. |

## Observed proof and limits

The reviewed retained record `repair-evidence/r3-status-oracle/raw-evidence.zip::final-repair/healthy/report.json` passed local R1–R8 and completed cleanup. Its actual precommit label is `c0c0399284621fed0908e39493ae6e296becf2c2@sha256-84455f625e2c41166d0ff4b80592d3a35fa30ff5bd69c3c1edc8a31b6490f52c`; the digest matches the committed candidate profile. This includes actual second-user MCP list isolation in repaired R4. The separate final seeded record failed explicitly at R3 and completed cleanup; the first healthy repair attempt was inconclusive during setup and remains so. No earlier outcome was rewritten.

These are disposable Convex/JWT/browser/AppBridge observations, supported by source review. Live WorkOS web sign-in, refresh, subject continuity, consent and exact-resource token issuance remain unverified, as does installed ChatGPT OAuth/tool/UI behavior (G1/G2 skipped). The configured WorkOS sandbox and local signatures do not establish those provider/host outcomes. The review is bounded to this private work-item model and configured single WorkOS environment, not organization permissions or a generalized authorization guarantee.

## Exact reviewed inputs

| Repository-relative file | SHA-256 | Bytes |
| --- | --- | --- |
| `examples/foundation/apps/web/src/main.tsx` | `d35db9680fea6c3ce2082d6d9e391b1c3dfe22db5968b28ba2da8da0d76cf9be` | 2812 |
| `examples/foundation/apps/web/src/router.tsx` | `d53d6c942972eff2e39f9e9bddaecd54e8210dccf36c86ffd4d2ae239f363798` | 720 |
| `examples/foundation/apps/web/src/work-items.tsx` | `7ec61a361e5cc4a9c001eed4a7f3530215829d6f1e6c446110167c64b41c33a8` | 6033 |
| `examples/foundation/packages/backend/.env.example` | `b8ae67eee31602ab2897a2ff95082c6bd88181efc7a4fb3bbdd4e90fb6f708f8` | 200 |
| `examples/foundation/packages/backend/.gitignore` | `c1be9a7b83075864153509fa626722510fd2507fe18e4548a4a89e11023048ea` | 12 |
| `examples/foundation/packages/backend/convex.json` | `fa3e766ef4d424da2f57361dca5369f073981fac42dd0a4e4641d8867faf51f3` | 135 |
| `examples/foundation/packages/backend/convex/_generated/api.ts` | `b51f59d5f03959d7978ef51ce4bb1918d5e966fcfd6c3510fe5847b65c11fbd2` | 1400 |
| `examples/foundation/packages/backend/convex/_generated/dataModel.ts` | `db177073d16a4393c7a96bcdc3a2a904e88c2432d54d138ca7715cc431982c17` | 1736 |
| `examples/foundation/packages/backend/convex/_generated/server.ts` | `4ef510cd49241e28128a9a462daadaa9743c628f3df5c2a3fa4ad3c9af6b9cc4` | 6349 |
| `examples/foundation/packages/backend/convex/auth.config.ts` | `d6881c29a3b941cf0d2ad3e59d4eb26d4804c5731d5b09d4ff4035aa37edd123` | 2331 |
| `examples/foundation/packages/backend/convex/http.ts` | `f7a33e2c070ec9cd4431835917a6fd672fd5b5390f636b06c41d3a6beb1315df` | 5043 |
| `examples/foundation/packages/backend/convex/lib/identity.ts` | `c07154240f019b4a4dafb1514ed4194c6e8479b9f69251c4d4d3c27252fe53da` | 1287 |
| `examples/foundation/packages/backend/convex/lib/mcp.ts` | `c5d6396b01551d057fa2cb63b175e6b5bb9c20cddcd06367a44cc1c301b11aae` | 4599 |
| `examples/foundation/packages/backend/convex/schema.ts` | `dbb8465c66ac2b6b16cd4029797c4a9d2d618c6ebefbfb61820d24e780ea3298` | 296 |
| `examples/foundation/packages/backend/convex/tsconfig.json` | `94563947ccb3f355ca83a8bb6b85632d6d77a5de9864c973eabeb3dc6a3b68a0` | 223 |
| `examples/foundation/packages/backend/convex/workItems.ts` | `091b683e3f92d4412cd04b8ea2dc2b86729eeb8e21cf32a903f76393087a0963` | 2394 |
| `examples/foundation/packages/backend/package.json` | `31b5657d4efecc5dfa7ba55e3d1b88a366950649e1b40e407808888a7c40b655` | 580 |
| `examples/foundation/packages/backend/tsconfig.json` | `4fd3e7337d33f357829d7bb17c24e8c46c5bed068caac3035f7703320a8a5f27` | 128 |
| `examples/foundation/packages/domain/src/index.ts` | `5b1e707a9bdab248b40f1414a646c96d3d2fc9651b363bee3d6c1d657d200479` | 650 |
