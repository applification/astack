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
