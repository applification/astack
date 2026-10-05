# Understand and shape the change

Use investigation when the first deliverable is understanding:

```text
$applification:investigate Trace how an item reaches the export and why retries can include it twice. Do not change code yet.
```

The answer should distinguish current behavior, recorded history and inference. Ask [show-me](../../skills/show-me/SKILL.md) for a small logic sketch or diagram when it makes ownership or order easier to assess.

For changed behavior, describe who acts and the observable result. A substantial feature keeps acceptance cases and unresolved choices in `.astack/<feature>/behavior-contract.md`. A small change can keep them in the conversation and PR.

```text
$applification:astack Add a bulk export that can resume after interruption. Show the state model and caller interface before implementing.
```

Trace affected consumers and settle data shapes and ownership before an expensive interface locks in. [domain-modeling](../../skills/domain-modeling/SKILL.md) resolves uncertain concepts and records agreed glossary terms; type-system and boundary principles shape their implementation. A prototype or competing sketches can settle an observable design question. The user settles product preferences that source or an experiment cannot answer.

For web UI, [web-feature](../../skills/web-feature/SKILL.md) decides separately whether Pen and Storybook would clarify direction or catch a component regression. A design frame supports a visual choice, a story supports an isolated state, and the running product supports the actual data path.

More scrutiny should answer a real risk. When independent contributions are authorized and useful, give each a bounded question and isolate writers by worktree. Assess findings against the actual source and intent. Sequential skill composition remains useful when delegation adds little.

Next: [Verify and maintain the loop](04-verification.md).
