# 0005 — Emulate, disposable Staging users and manual acceptance

Status: accepted. Owner instruction: this chat, 5 October 2026.

WorkOS Emulate is the normal local/CI AuthKit test dependency. Seed deterministic users and linked identities; exercise session behavior and application authorization through supported APIs and the actual app. Preserve local Convex and the real production authentication boundary. Synthetic expired/wrong-audience credentials remain negative controls, not successful provider proof.

Use the dedicated astack Staging environment for a small opt-in real-provider suite. Create unique disposable verified users and generated passwords during setup, authenticate through the SDK where possible, and clean up after success or failure. Preserve an owned external-ID recovery journal for interrupted operations. Do not maintain a shared test identity or password. Remove reliance on `voiced@applification.net`.

Manual G1/G2 acceptance still establishes real Hosted AuthKit redirects/refresh/subject continuity, MCP OAuth consent and exact-resource issuance, and the same real WorkOS subject across web/MCP. Installed ChatGPT MCP/App behavior has a separate H1 host check. Neither Emulate success nor a staging SDK session establishes those UI/host behaviors.

This refines the proof boundaries in ADRs 0001, 0002 and 0004. It does not change the core platform, ownership model or user-initiated cloud transition. Procedures and current limits are in [the reference auth contract](../../examples/foundation/.astack/auth-testing.md).
