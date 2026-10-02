# Recorded green exploration

`green-exploration.json` retains verdict and step fields from the real e2e@0.15.1 Loami state-consistency smoke run on 2026-10-02. It exited zero with `status: passed`, no findings, one failed agent step and `ended: step-limit`. Paths, source/config identity, prompts, transcripts, media and usage were removed. This is recorded report evidence, not a live exploration run or generated coverage claim.

Source: [Loami PR #7](https://github.com/applification/loami-chat/pull/7), [retained setup observations](https://github.com/applification/loami-chat/blob/b0267c1f8bd66a3760c314ede4df8ab4e892caa3/.astack/presence/evidence/testerarmy/setup/README.md), charter run `2026-10-02T12-20-16.463Z-7ca0f61d/state-consistency`.

Policy tests derive timeout and candidate variants from this fixture. Those variants are synthetic, explicitly distinct from the recorded observation.
