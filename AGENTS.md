# Agent instructions

astack is three things, and nothing else:

1. `skills/`: reusable engineering skills, shipped as a plugin.
2. `lint/`: mechanical checks for the skills and plugin package.
3. `loops/`: prompts that compose the skills on a schedule or a mention.

`site/` is the public explainer for those three, published at astack.applification.net. Keep it.

When changing this repository:

- Keep application languages, frameworks, providers, platform skills and lint/compiler configuration in the consuming project. Core guidance uses the project’s selected tools.
- Every change serves one of those three. Apps, examples and product experiments live in their own repositories.
- A skill is one directory under `skills/`. Keep `SKILL.md` short. When a rule can be checked mechanically, put it in `lint/` and delete the prose.
- Commit no evidence: no screenshots, logs or run records. Proof goes in the pull request description.
- When a change alters what astack does, update `site/` and the README in the same pull request.
- Prefer deleting to adding. Resolve a review finding by fixing or removing text before adding a qualifier.
- Run `bun run check` before finishing, and finish kept changes in a pull request.
