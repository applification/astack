# Agent instructions

astack is three things, and nothing else:

1. `skills/`: reusable engineering skills, shipped as a plugin.
2. `lint/`: shared lint rules and compiler settings that give agents feedback.
3. `loops/`: prompts that compose the skills on a schedule or a mention.

When changing this repository:

- Every change serves one of those three. Apps, examples and product experiments live in their own repositories.
- A skill is one directory under `skills/`. Keep `SKILL.md` short. When a rule can be checked mechanically, put it in `lint/` and delete the prose.
- Commit no evidence: no screenshots, logs or run records. Proof goes in the pull request description.
- Prefer deleting to adding. Resolve a review finding by fixing or removing text before adding a qualifier.
- Run `bun run check` before finishing, and finish kept changes in a pull request.
