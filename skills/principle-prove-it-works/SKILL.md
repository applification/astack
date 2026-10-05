---
name: principle-prove-it-works
description: Verify a claimed outcome against the real artifact, command, running behavior or authoritative value before reporting completion.
license: MIT
metadata:
  short-description: "Prove claimed outcomes against the actual artifact"
---

# Prove It Works

Verify every task output by checking the real thing directly. Do not infer from proxies, self-reports, or "it compiles."

**Why:** Unverified work has unknown correctness. Indirect verification (file mtimes, output freshness, agent self-reports, cached screenshots) feels cheaper than direct observation. Acting on a wrong inference costs far more than checking the source.

Check the real thing, not a proxy:
- Check process liveness directly, not indirectly through derived state
- Read the actual value, not a cached or derived representation
- When verification fails, suspect the observation method before suspecting the system

## Script the check when you can

The strongest proof is a deterministic script that re-runs the same comparison, not a one-time eyeball. Write the script, run it, and keep its output as an artifact a reviewer can re-run instead of trusting your word.

Keep the artifact visible for the human. Retain decisive sanitized evidence according to [verification policy](../verify/references/proof-policy.md#keep-review-evidence-proportional); full temporary run directories can stay ignored. A claim must name its actual revision/environment and any gap.

Apply this leaf directly or alongside a workflow/platform skill. Read relevant project instructions and `.astack/project.md` when present. Return the concrete decision and actual evidence or limits; the caller owns delivery and publication.

[Imported source and adaptations](upstream.json); [MIT licence](LICENSE).
