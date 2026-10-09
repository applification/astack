---
name: architect
description: Design types, APIs and module ownership before implementing a consequential interface, persisted shape, lifecycle or abstraction; use for architecture requests and costly design choices.
license: MIT
metadata:
  short-description: "Design APIs and ownership from the caller's usage"
---

# Design the shape

Read project instructions, `.astack/project.md` when present, affected consumers and existing decisions. Preserve the requested behavior and the established stack. Use this for a consequential design choice; a routine change using a settled interface needs no separate design artifact.

Start with the caller's actual usage and observable result. Trace the existing data and lifecycle before designing an interface around it. Identify who owns state, which invariants must hold, and where external data is parsed. Apply [type discipline](../principle-type-system-discipline/SKILL.md) and [boundary discipline](../principle-boundary-discipline/SKILL.md) at those decisions.

Produce a small code sketch of types, signatures and module ownership before wiring the implementation. Use [the sketch guidance](references/design-sketch.md) for a concrete format. Compare a structurally different alternative when an unresolved tradeoff matters; explain the cost that rules it out. Prefer the shape that makes consumer code direct and removes unnecessary state, branches or wrappers. More abstraction is not a design goal.

For persisted migrations, retries, background work or shared lifecycles, include compatibility, cancellation, interruption and recovery cases. Identify operation identity and atomic effects where duplicate delivery is possible. Make these cases part of the owning behavior contract rather than private implementation assumptions.

Proceed within the caller's authorized scope. A design request returns the sketch and rationale; an implementation caller uses it to continue delivery without a new approval gate. A material product decision still belongs to its owner. If implementation repeatedly needs the same escape hatch or workaround, revisit the ownership or type model before extending that pattern.

Return the chosen usage, boundaries, invariants, rejected alternative when relevant, distinguishing checks and unresolved choices. Retain the sketch beside the existing task/decision record when it will help review or resumption. The caller owns implementation, verification and publication.

[Source and adaptations](upstream.json); [MIT licence](LICENSE).
