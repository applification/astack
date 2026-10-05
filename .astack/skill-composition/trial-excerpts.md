# Selected trial source and results

These excerpts support the [observations](evidence.md). Full outputs remain ignored; original hashes and fixture revisions are retained in [observations.json](observations.json). Paths below name disposable fixture files, not production source. Each fresh fixture had a Node ESM package with `node --test test/reservations.test.mjs`, no remote or external services, and project instructions preserving runtime, test expectations and local authority.

## Failure and acceptance

Original `reservations.mjs`:

```js
export function cancelReservation(items, id, actor) {
  const selected = items.find(item => item.id === id);
  if (!selected || selected.owner !== actor) throw new Error('denied');
  return items.filter(item => item.visit !== selected.visit);
}
```

The existing tests:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cancelReservation } from '../reservations.mjs';
const items=[{id:'r1',visit:'v1',owner:'alice'},{id:'r2',visit:'v1',owner:'bob'}];
test('cancel only the selected reservation',()=>assert.deepEqual(cancelReservation(items,'r1','alice'),[items[1]]));
test('another owner is denied',()=>assert.throws(()=>cancelReservation(items,'r1','bob'),/denied/));
```

Original glossary: Reservation holds places for a guest on one scheduled visit; Owner is the authenticated account permitted to manage it; Cancellation ends one reservation and leaves others on the visit. The domain-modeling request explicitly supplied the agreed Guest definition and prohibited deciding the cancellation choice or changing runtime code.

## Direct explanation and glossary result

show-me returned this source-grounded view without file edits:

```text
cancelReservation(items, id, actor)
  find selected by id
  missing or selected.owner !== actor → throw "denied"
  return new array excluding ALL items with selected.visit
```

domain-modeling added Guest to GLOSSARY.md and reported: the glossary and test specify one reservation, while implementation removes every reservation on the visit after checking only the selected reservation's Owner. Its distinguishing case asked whether Bob's reservation should remain when Alice cancels hers. It left the requested choice unresolved and reported the observed cancellation failure/owner-denial pass.

## Composed delivery and PR result

The astack agent announced the bug-fix route with verification and local PR preparation. Its trace explicitly read installed bug-fix, verify and pr instructions, then capability selection and proof policy. Its only runtime diff was:

```diff
-  return items.filter(item => item.visit !== selected.visit);
+  return items.filter(item => item.id !== selected.id);
```

The same tests went from 1 pass/1 fail to 2 passes. Additional assertions covered both owners cancelling their own record, preservation of another same-owner record on the same visit, preservation on another visit, unauthorized/missing-ID denial and unchanged input. The resulting module hash was `cc3dbaf756b5b9a9551d8fcc0ff19dc4db35b8a2fe683a36a45c6e612ae492c1`.

The agent's local PR description tied observations to base `2720440a05031b89c76691ce556bd03a0b8fbe84` plus that working-tree hash, disclosed self-review, and marked UI/external integration inapplicable to the fixture. The direct pr trial reviewed an already committed equivalent fix and wrote its own description; it distinguished the caller-supplied actor check from actual authentication and left duplicate-ID uniqueness unverified. Neither trial created a remote or external PR.
