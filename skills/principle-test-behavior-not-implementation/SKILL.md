---
name: principle-test-behavior-not-implementation
description: Design or review checks that exercise the consumer-facing behavior and distinguish a plausible defect through meaningful assertions.
license: MIT
metadata:
  short-description: "Assert observable behavior with distinguishing checks"
---

# Test Behavior, Not Implementation

A test calls the code the way its users do and asserts the result they observe against a literal expected value. A test that asserts which calls the code made, or restates a constant the code contains, does neither.

Before keeping a test, ask whether an empty or plausibly wrong implementation could pass it. Rewrite or delete a check that never exercises its subject or cannot distinguish the named failure. Returning `undefined` is one useful probe, not a complete test of assertion quality.

**Why:** A test that cannot fail for a defect costs CI time and review attention and catches nothing. A constant pin also fails when someone edits the constant or the prompt it restates, so it prevents that edit.

**Warning signs to examine for weak assertions:**

- **Weak or no assertion.** No `expect`, or only `toBeDefined`, `toBeTruthy`, `not.toThrow`, `toBeInstanceOf`, `toBeGreaterThan(0)`.
- **Mock or absence only.** Only `toHaveBeenCalled`, `not.toHaveBeenCalled`, `toBeUndefined`, `toEqual([])`, `toHaveLength(0)`, `not.toBe(wrongValue)`.
- **Self-referential.** The expected value comes from the code under test: `expect(f(a)).toBe(f(a))`, `expect(parsed.url).toBe(buildUrl(...))`.
- **Constant pin.** The assertion restates a hand-maintained constant, config default, table row, or prompt string: `expect(LIMITS.maxTools).toBe(8)`, `expect(PROMPT).toContain("You are")`.
- **Fixture asserts fixture.** The assertion reads data the test built or a value computed in `beforeEach`, and the subject never runs inside the body.

**The fix:** call the subject inside the test body with one concrete input and assert the literal output or the observable effect, `expect(slugify("Hello, World!")).toBe("hello-world")`. An absence or rejection can be the correct expected behavior; pair it with a meaningful success/control case where useful. For a constant, test the mechanism that reads it with one input instead of restating the value. For a mock, assert the payload it received or the state after the call, not that it was called. When no such assertion exists, delete the test.

**Keep** a test of a relation across a table's rows (a key present in two tables, a parent that exists), and a compile-time check in a `*.test-d.ts` file.

Apply this leaf directly or alongside a workflow/platform skill. Read relevant project instructions and `.astack/project.md` when present. Return the concrete decision and actual evidence or limits; the caller owns delivery and publication.

[Imported source and adaptations](upstream.json); [MIT licence](LICENSE).
