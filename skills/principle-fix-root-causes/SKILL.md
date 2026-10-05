---
name: principle-fix-root-causes
description: Diagnose a reported defect from a reproduction, source and runtime observations, then repair its supported cause within the requested scope.
license: MIT
metadata:
  short-description: "Reproduce defects and repair their supported cause"
---

# Fix Root Causes

When debugging, do not fix symptoms. Trace every problem to its root cause and fix it there.

**Why:** Symptom fixes accumulate. Each workaround makes the system harder to reason about, and the real bug remains. Root-cause fixes are slower upfront but reduce total debugging time.

**Pattern:**
- Reproduce first
- Ask "why" until you hit the root cause
- Keep validation at the actual trust boundary; avoid a guard that merely hides a violated internal invariant
- Inspect the constraint behind a workaround; remove it only when source or observations support doing so
- Search for the same cause in affected consumers with `rg`; repair instances within scope and report broader work separately
- When stuck, instrument. Don't guess (add logging, read the actual error)

**Restart bugs: suspect state before code**

When something "fails after restart," suspect stale persistent state first: config files, caches, lock files, serialized state. If clearing a state file restores behavior, investigate state validation and upgrade compatibility. Use disposable state for diagnosis and preserve real data; clearing it alone is not a repair.

Apply this leaf directly or alongside a workflow/platform skill. Read relevant project instructions and `.astack/project.md` when present. Return the concrete decision and actual evidence or limits; the caller owns delivery and publication.

[Imported source and adaptations](upstream.json); [MIT licence](LICENSE).
