# ✗ \[A1\] choosing the selected state stops playback

`tests/selected-state.probe.ts` · failed · 1.9s

**ASSERTION_FAILED**

```text
expect.toBeVisible failed
locator: getByRole("button", name: "Play sequence")
expected: visible
observed: no node (match count 0)
```

Look at: `tests/selection.ts:8`  

## Steps

1. ✓ `app.open` `/` (68ms) — `tests/helpers.ts:10`
2. ✓ `expect.toBeVisible` `getByRole("button", name: "Pause sequence")` (28ms) — `tests/selection.ts:5`
3. ✓ `expect.toHaveAttribute` `getByRole("button", name: "Idle")` (8ms) — `tests/selection.ts:6`
4. ✓ `locator.tap` `getByRole("button", name: "Idle")` (51ms) — `tests/selection.ts:7`
5. ✗ `expect.toBeVisible` `getByRole("button", name: "Play sequence")` (1.5s) — **ASSERTION_FAILED** — `tests/selection.ts:8`

## Screen at failure

URL: `http://127.0.0.1:51168/`  

The screen as the agent reads it, one node per line: `#id role "name" text="…" [states]`.

```text
# Screen at failure
url: http://127.0.0.1:51168/
revision: b1
viewport: 1000x700
nodes: 5

#root document "Selection proof reference"
 #n5 heading "Selection proof reference"
 #n6 status "Idle selected"
 #n7 button "Idle" [pressed focused]
 #n8 button "Pause sequence"
```

## Evidence

- screenshot `.e2e/runs/probe-00f2dde8-3d3e-40fc-bf31-401fc4982692/artifacts/desktop/tests_selected-state.probe.ts___5BA1_5D_20choosing_20the_20selected_20state_20stops_20playback-4af48ae5/default/attempt-0/screen…`
- log `.e2e/runs/probe-00f2dde8-3d3e-40fc-bf31-401fc4982692/artifacts/desktop/tests_selected-state.probe.ts___5BA1_5D_20choosing_20the_20selected_20state_20stops_20playback-4af48ae5/default/attempt-0/failur…`
- trace `.e2e/runs/probe-00f2dde8-3d3e-40fc-bf31-401fc4982692/artifacts/desktop/tests_selected-state.probe.ts___5BA1_5D_20choosing_20the_20selected_20state_20stops_20playback-4af48ae5/default/attempt-0/trace/…`

<sub>e2e 0.15.1 · run `01a10ba3-5333-7ace-ad07-b46b43836e29` · the whole run is in `report.json`</sub>
