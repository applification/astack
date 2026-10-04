# Dependable project foundation

Design brief: [astack iteration plan](https://chatgpt.com/space/page_b11134b1d1708191adcbfc59518d1580).

The owner confirmed on 4 October 2026 that Convex, MCP and WorkOS form the core profile; React forms and data should follow supported platform approaches; tests follow behaviour rather than filename; a work-item reference app is suitable. The existing entry, routes and project compatibility remain authoritative. The reference lives in `examples/foundation`; astack itself remains a guidance plugin.

## Outcome

A fresh checkout creates a repeatable project in which an agent can make, observe and review a small change across standalone web, MCP and the shared Convex backend. Commands perform mechanical setup and report their actual coverage. No COS, live signal ingestion, specialist expansion, merge or release is included.

## Acceptance

| ID | Observable case | Check / evidence |
| --- | --- | --- |
| F1 | Create an independent project without copying credentials, local databases or build output; refuse an existing destination. Frozen installation and package imports work. | Scaffold check, lockfile install, workspace checks. |
| F2 | Strict types, correctness and portable-UI boundaries accept valid examples and reject representative violations, including relative/alias import bypasses. | Enforcement probes; shared config and package coverage. |
| F3 | Quick, affected and CI commands report scope and fail on required errors; shared changes select consumers; hooks preserve partially staged work. | Command probes and cold/warm timings. |
| F4 | Identify the intended running build; create from the web, observe it through a fresh backend read, change it through MCP and observe the web update. | Disposable real Convex deployment and Chromium journey. |
| F5 | Anonymous, wrong audience, expired and another user's calls cannot read/change owned data; web session credentials cannot authenticate the MCP endpoint. | Real signed proof identities at actual deployed functions and HTTP transport. |
| F6 | The same presentation UI renders in standalone and MCP Apps contexts, validates incoming results, and handles pending/error/empty states and lifecycle cleanup. | Stories, bundled resource, real protocol client and local AppBridge host. Installed-host evidence is separate. |
| F7 | WorkOS web login and MCP OAuth preserve the same subject but validate their distinct issuer/audience contracts. | Official provider wiring, deployment checks, live provider checks when configured. Local keys do not prove WorkOS OAuth. |
| F8 | Fresh agents using the candidate entry create the foundation, deliver a feature and fix a seeded defect; another agent reviews; repeat with the same rubric. | Candidate digest/revision, prompts, result, proof and independent scored review. |
| F9 | Existing plugin, site and relevant reference validations pass; evidence survives cleanup. | Existing checks and retained redacted proof. |

## Principles and decisions

TS 01–10, UI 01, DATA 01, STATE 01, EFFECT 01, API 01, COMPOSE 01, DESIGN 01, COMP 01, TEST 01, LOOP 01, WORK 01, ADR 01–02, FEEDBACK 01, LINT 01–02, TURBO 01 and HOOK 01 apply with the scopes and exceptions in the brief. See [ADR register](../../docs/adr/README.md). Mechanical checks establish detectable violations; review owns semantic composition, test quality and product judgement.

Pencil: skipped for this worked engineering profile; no existing visual design to reconcile. Storybook: selected for the shared UI and form states. Real browser and protocol checks establish integration; an emulated host is labelled local bridge evidence.

## Baseline and first slice

Baseline `f29f52d`: guidance and runnable protocol/e2e references exist; no repeatable Vite + Convex + WorkOS + MCP profile, readiness command or observed fresh-agent delivery trials exist. Build one profile, its supported examples and enforcement, then run the trials. The Page is the direction; this folder records implementation and revision-specific observations. Evidence and remaining gaps are in `evidence.md`.
