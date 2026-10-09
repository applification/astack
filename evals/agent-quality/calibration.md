# Calibrate a craftsmanship reviewer

These controls are authored examples with explicit behavioral answers. They are a starting calibration set, not an independently certified or human-adjudicated corpus. The owner confirms the labels and adjudicates reviewer disagreements before trusting quality grades. Keep this answer key out of the reviewer's initial context.

Give the reviewer each snippet under a shuffled anonymous label, with the task: “Save a valid non-empty title for an owned note and preserve the other actor's records.” Ask for correctness/ownership findings and evidence. Do not tell it which snippet is expected to fail. Add real trial diffs once their outcomes have been independently checked.

## Control 1: clear ownership and effect

```text
saveTitle(actor, id, input):
  title = parseNonEmptyTitle(input)
  note = storage.read(id)
  require note.owner == actor
  storage.update(id, {title})
  return storage.read(id)
```

Expected: this sketch supports boundary parsing, explicit ownership and a persisted read. It does not establish atomicity under concurrent changes or actual runtime behavior. A reviewer should not invent a confirmed race or assign a runtime pass from the sketch alone.

## Control 2: reassuring response without persistence

```text
saveTitle(actor, id, input):
  title = parseNonEmptyTitle(input)
  note = storage.read(id)
  require note.owner == actor
  return {...note, title}
```

Expected: confirmed missing persistent write. A fresh read must retain the old title; displaying the returned value would hide the defect. The regression needs authoritative storage/read evidence.

## Control 3: update before checking the actor

```text
saveTitle(actor, id, input):
  title = parseNonEmptyTitle(input)
  storage.update(id, {title})
  note = storage.read(id)
  require note.owner == actor
  return note
```

Expected: the unauthorized actor can change data before receiving denial unless the real transaction rolls back the write. Require the reviewer to inspect transaction semantics or demonstrate the effect, rather than assume rollback or lack of rollback. The accepted finding is an unproven ordering/atomicity invariant with a distinguishing denied-operation probe.

## Control 4: weak assertion

```text
result = saveTitle(actor, note.id, "Edited")
assert result != null
```

Expected: this assertion cannot distinguish an acknowledged but discarded write. Require a literal title comparison from a fresh read, plus the rejected-owner operation when it is part of acceptance.

Record detected/missed material defects, unsupported findings and evidence quality. False passes matter independently of average scores. Keep findings that require a runtime prerequisite marked unverified. Use the same rubric for every candidate and preserve its version. A different model family may add perspective; it is not itself a calibration certificate.

## Qualification before candidate grading

Predeclare a task-appropriate minimum corpus and pass rule before reading candidate results. For this starter exercise, the owner first confirms all four labels. A provisional reviewer must find the discarded write and weak assertion, treat transaction semantics as unproven, avoid claiming runtime or permission proof from the good sketch, and make no unsupported critical finding or false pass. Any miss or invented critical claim leaves quality unassessed until corrected calibration succeeds. Record useful-finding precision and the owner's adjudication; four authored controls only qualify this initial review exercise. They do not establish general grader accuracy. Expand coverage with independently checked real diffs before a broad improvement claim.
