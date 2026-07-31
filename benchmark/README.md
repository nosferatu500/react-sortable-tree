# Benchmark

Compares three drag-and-drop tree libraries on the same tree, in the same
viewport, in a real browser:

| id         | package                                    | React |
| ---------- | ------------------------------------------ | ----- |
| `fork`     | `@nosferatu500/react-sortable-tree` (this) | 19    |
| `original` | `react-sortable-tree@2.8.0`                | 16.14 |
| `minoru`   | `@minoru/react-dnd-treeview@3.5.4`         | 19    |

The original's peer range stops at React 16, so it is benchmarked on the newest
React it supports. Whether it runs on React 19 at all is measured separately by
the `compat19` page rather than assumed.

## Running it

```sh
npm run setup    # build the fork and pack it into vendor/
npm install
cd legacy && npm install && cd ..
cd compat19 && npm install --legacy-peer-deps && cd ..
npm run bench    # build.mjs + run.mjs
node report.mjs  # results.json -> RESULTS.md
node footprint.mjs   # install size, writes footprint.json
```

`CHROME_PATH` overrides the browser location; it defaults to Google Chrome on
macOS. `debug.mjs <id>` and `probe.mjs <id> <nodes>` dump the rendered DOM and
every DevTools counter for one page, which is how the harness was validated.

## What is measured

Each library renders 10 expanded groups sharing the node budget, so 10,000 nodes
means 10 groups of 999 children. Scenarios, per size, median of 5 runs after a
discarded warm-up:

- **Mount** — create the root and render the whole tree.
- **Expand a group** — collapse group 0, then expand it again, moving ~1/10th of
  the rows. The expand half is reported.
- **Scroll** — 40 equal jumps from top to bottom, one per animation frame.
- **DOM elements / event listeners / JS heap** — measured while mounted, with
  the heap read after a forced GC.

## Why these numbers and not others

**CPU time, from `Performance.getMetrics.ThreadTime`.** Two earlier attempts were
wrong in ways worth recording:

- `ScriptDuration` + `RecalcStyleDuration` + `LayoutDuration` looks like the
  obvious choice and is badly misleading here. Work started from a CDP evaluate
  is booked to `DevToolsCommandDuration` instead, so `ScriptDuration` read as
  near-zero — it reported 78 ms for a mount that actually took 2.5 seconds.
- Wall-clock is dominated by waiting for vsync. Disabling vsync
  (`--disable-gpu-vsync --disable-frame-rate-limit`) decouples
  `requestAnimationFrame` from real painting, which silently breaks every
  "wait for the frame" measurement: rAF then fires before React has committed,
  and the harness cheerfully measured an empty tree in 0.4 ms.

`ThreadTime` is renderer main-thread CPU time. It ignores idle waiting, counts
work no matter which task started it, and is what determines whether the page
stays responsive.

**Commits are flushed synchronously.** `flushSync` plus a forced layout read
keeps the React 19 harnesses comparable with the React 16 legacy root, which
commits synchronously anyway.

**First paint is reported separately.** `virtua` sizes its viewport from a
ResizeObserver, so this fork's first commit contains no rows and they arrive one
frame later; the other two emit their rows during the commit. Every library gets
the same treatment (wait until rows exist, then one more paint), and the number
includes vsync waiting — so treat differences under ~8 ms as noise.

## Known asymmetries

Kept deliberately, and all of them flatter the other two libraries:

- `@minoru/react-dnd-treeview` is headless, so its row is a plain flex div. The
  two react-sortable-tree rows draw scaffold lines, a drag handle and a toggle,
  which is more work per row. Its per-row cost is therefore understated.
- `react-virtualized` overscans 10 rows by default and `virtua` fewer, so the
  original renders 20 rows per viewport against this fork's 13. Both are library
  defaults, and more rows means more work.
- All three run through the same `react-dnd` `HTML5Backend` and the
  context-less tree export, so the DnD provider cost is identical and included
  everywhere.
- Row height is pinned to 62px (both react-sortable-tree defaults) and the
  viewport to 600×900 for all three, so every library shows the same ~10 rows.

## Files

| file                    | what                                                  |
| ----------------------- | ----------------------------------------------------- |
| `harness/bench-core.js` | shared, dependency-free browser-side primitives       |
| `harness/*.jsx`         | React 19 adapters                                     |
| `legacy/original.jsx`   | React 16 adapter, in its own workspace for resolution |
| `compat19/`             | the original mounted on React 19                      |
| `build.mjs`             | harness bundles + bundle-size measurement             |
| `run.mjs`               | Chrome driver, writes `results.json`                  |
| `report.mjs`            | `results.json` -> `RESULTS.md`                        |
| `footprint.mjs`         | packages and disk per library                         |
