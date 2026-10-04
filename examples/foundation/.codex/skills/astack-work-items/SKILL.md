---
name: astack-work-items
description: Inspect and drive the Work items reference through its actual web, Convex and MCP surfaces with disposable local identities.
---

Read `.astack/feature-map/work-items/README.md` for the product paths. Run `./.codex/skills/astack-work-items/control.ts doctor --json` before proof. This command is read-only and reports checkout prerequisites; it does not certify a running target.

Run `./.codex/skills/astack-work-items/control.ts verify --json` to launch a disposable local copy, create a work item through the web, confirm persistence, change its status through MCP, reload the web, check identity and ownership denials, and render its MCP App through a local AppBridge host. Use `--evidence <directory>` to select where the report, redacted logs and screenshots survive cleanup. The command stops only its own processes and deletes its temporary tokens and data.

Read `report.json` and every check outcome before claiming proof. A startup failure is inconclusive; an observed acceptance mismatch fails. Local issuer and AppBridge results do not establish live WorkOS login or installed ChatGPT behavior. Keep those gaps explicit. The executable is checkout-local and needs no global installation.
