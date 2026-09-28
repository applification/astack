# Project setup

Use this when installing AStack in a project or when the task needs a proof route that the project has not described.

Inspect the actual repository first: entry points and user surfaces, package scripts or task runner, local startup and fixture commands, existing tests and CI, authentication and safe data environments, project instructions, issue/PR workflow, and the current home for durable domain terms or decisions. Reuse working paths. Confirm a proposed command from its source or by running a safe check; do not invent a command that merely sounds conventional.

Create or update `.astack/project.md` with only what a later agent cannot cheaply infer:

```markdown
# AStack project profile

## Product surfaces
Who uses each surface and which repository area serves it.

## Feedback and proof
Fast checks while editing; checkpoint checks; how to start, identify, drive,
and stop a disposable running instance; safe fixtures; evidence location.
Name checks that establish only a component or contract and those that reach
the real user path.

## Selection rules
Which behavior or dependency changes call for each surface, including indirect
effects such as backend changes exposed through another client.

## Project decisions
Where durable domain terms and consequential decisions live; PR and release
rules; actions reserved for the owner.
```

Write concise paths and commands, with pointers to authoritative project docs. Do not copy long procedures or secrets into the profile. AStack does not prescribe an issue tracker or a universal test runner. A project may replace old guidance while adopting AStack; reconcile conflicting instructions rather than leaving two active processes.

Exercise one harmless proof route after setup. If it cannot run, record the missing prerequisite and the exact limit; setup is not complete merely because the file exists.
