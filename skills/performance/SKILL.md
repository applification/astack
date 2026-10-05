---
name: performance
description: Investigate measured slowness and verify an improvement against a comparable baseline.
metadata:
  short-description: "Measure bottlenecks and verify performance changes"
---

# Performance

Use this skill directly for the requested outcome, or as the selected astack delivery route. Read relevant project instructions and working commands; user scope and project constraints take precedence.

Identify the user-visible or operational metric and measure a baseline under comparable conditions. Investigate the bottleneck before editing, change one plausible cause, and compare against the baseline. Report the size and limits of the measurement. A faster microbenchmark does not prove a faster user path unless it represents that path. When the route changes the repository, end with a [pull request](../pr/SKILL.md) containing the comparable measurements.

Record the revision, environment, workload and metric before changing code. Use the same relevant conditions for the after measurement and state confounders or noisy samples. Return the observed change and practical limits; do not turn an unmeasured speed request into a speculative rewrite.

Read and apply linked skills when needed. Skill composition is sequential instruction use unless delegation is available, permitted and useful; it does not require a new agent. Keep one writer per worktree and return unresolved decisions to the caller.
