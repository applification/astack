---
name: investigate
description: Answer an engineering question from code, history, primary sources or running behavior without starting unrequested implementation.
metadata:
  short-description: "Answer engineering questions from source and evidence"
---

# Investigation

Use this skill directly for the requested outcome, or as the selected astack delivery route. Read relevant project instructions, `.astack/project.md` when present and working commands; user scope and project constraints take precedence.

Answer the question from code, history, running behavior, or primary documentation as appropriate. Separate observed facts from inference. Recommend an option with tradeoffs when asked; do not create implementation work merely to make the answer feel complete. A read-only investigation ends with the answer; if the user asks to implement a finding, use the relevant change route and its PR.

State your interpretation if scope is ambiguous and investigate while the user can redirect. Use show-me for a useful mental model and domain-modeling when terminology affects the answer. Return the answer early, with source evidence, inference, uncertainties and requested tradeoffs. Do not push, create a PR or change code for a read-only question.

Read and apply linked skills when needed. Skill composition is sequential instruction use unless delegation is available, permitted and useful; it does not require a new agent. Keep one writer per worktree and return unresolved decisions to the caller.
