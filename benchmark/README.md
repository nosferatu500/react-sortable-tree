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

From the repository root:

```sh
npm run bench:setup   # build + pack the fork, install all three workspaces
npm run bench         # footprint + build + run + report
```

Or step by step from this directory, once the workspaces are installed:

```sh
node pack-fork.mjs   # rebuild the fork into vendor/fork.tgz
node build.mjs       # harness bundles + bundle-size measurement
node run.mjs         # drive Chrome, write results.json
node footprint.mjs   # install size, writes footprint.json
node report.mjs      # results.json + footprint.json -> RESULTS.md
```

`footprint.mjs` has to run before `report.mjs`, which reads its output.
`pack-fork.mjs` normalises the tarball to `vendor/fork.tgz` so the `file:`
dependency does not have to be edited on every version bump.

`CHROME_PATH` overrides the browser location; it defaults to Google Chrome on
macOS. `debug.mjs <id>` and `probe.mjs <id> <nodes>` dump the rendered DOM and
every DevTools counter for one page, which is how the harness was validated.

## What is measured

Each library renders 10 expanded groups sharing the node budget, so 10,000 nodes
means 10 groups of 999 children. Scenarios, per size, median of 11 runs after a
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

**Medians carry their range, and wins have to clear it.** `results.json` stores
`min`/`max` alongside the median for every timing, and `report.mjs` only bolds a
figure when the winner's slowest run still beat the runner-up's fastest run.
This matters more than it sounds: at 5 runs, which of the two
react-sortable-tree builds "won" mount and expand flipped between otherwise
identical benchmark runs. 11 runs settles it — they tie, which is the expected
answer for a library and its own fork.

**Frame timings are recorded alongside scroll CPU.** Every library scrolled at
full frame rate at every size here, so the scroll-CPU column measures headroom
spent, not stutter a user would notice. Reporting the CPU number without the
frame number would make a trade-off look like a defect.

**First paint is reported separately.** `virtua` sizes its viewport from a
ResizeObserver, so this fork's first commit contains no rows and they arrive one
frame later; the other two emit their rows during the commit. Every library gets
the same treatment (wait until rows exist, then one more paint), and the number
includes vsync waiting — so treat differences under ~8 ms as noise.

## Method: proving a before/after

This section is the one to read before quoting any number from this codebase. It moved here
from a planning document that has been deleted; the traps in it were all paid for.

**Single-shot timings of this code are meaningless.** The same unchanged
`getFlatDataFromTree` measured 3.0 ms at 20 iterations and 0.49 ms at 400, purely from JIT
warmup, and the row-allocating functions are sensitive to GC pressure on top of that. Any
before/after claim has to run **both** implementations in the same process under the same
harness.

**A median-only two-way harness is not enough either.** One once blamed `.entries()` for a 3x
flatten regression on one run and the _unchanged_ indexed variant on the next — a GC pause
landing on whichever side was being measured. Rotate the side order per trial, take the
**minimum**, then confirm across runs. Minimum is the right statistic for "how much work is
there": noise only ever adds.

**In a browser, batch before you divide.** `performance.now()` is clamped to 100µs and a single
React commit lands at 1-2 ms, so one measurement per trial quantises to a handful of values.
The keyboard-backend attribution below timed one expand at first and the difference _changed
sign between runs_ (+0.28, -0.23, +0.48 ms); at 120 expands per trial the noise collapsed and
the real effect was 0.0-0.3 ms — small enough to rule the theory out. One run of the noisy
version would have "confirmed" it.

**Check that you are measuring anything at all.** A virtualized expand does not change the DOM
row count, so counting rows cannot tell you the expand happened — the first version of that
same harness measured nothing and reported a plausible number. `scrollHeight` tracks the whole
flattened list, which is what it asserts on now.

**Some questions want a count, not a timing.** Row memoization was verified by counting
renders (`react-sortable-tree.test.tsx`, "render stability"), not by timing: a deterministic
count beats a timing on a yes-or-no question, and an earlier memoization attempt went unnoticed
as a no-op precisely because nothing counted.

### The Node-side A/B harness

For `tree-data-utils` functions, bundle the two versions side by side —
`git show <ref>:src/utils/tree-data-utils.ts` for the "before" side, the working tree for
"after" — with esbuild (`platform: 'neutral'`) into `old.js` / `new.js`, then:

```js
const median = (xs) =>
  xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]

const ab = (label, mk, iters, trials = 9) => {
  const fns = { old: mk(OLD), new: mk(NEW) }
  for (const f of Object.values(fns)) for (let i = 0; i < iters; i++) f() // warm both
  const t = { old: [], new: [] }
  for (let k = 0; k < trials; k++) {
    for (const side of ['old', 'new']) {
      const t0 = performance.now()
      for (let i = 0; i < iters; i++) fns[side]()
      t[side].push((performance.now() - t0) / iters)
    }
  }
  const o = median(t.old),
    n = median(t.new)
  console.log(
    label,
    o.toFixed(4),
    'ms ->',
    n.toFixed(4),
    'ms',
    `(${(o / n).toFixed(1)}x)`
  )
}

// balanced fixture: `breadth` roots, binary, `depth` deep, everything expanded
const build = (breadth, depth) => {
  const make = (d, i) => ({
    title: `n-${d}-${i}`,
    expanded: true,
    children:
      d === 0 ? undefined : [make(d - 1, i * 2), make(d - 1, i * 2 + 1)],
  })
  return Array.from({ length: breadth }, (_, i) => make(depth, i))
}

const treeData = build(40, 7) // 10,200 visible nodes
```

The end-to-end drag-hover figure simulates one mousemove: `insertNode` + `changeNodeAtPath`
for `dragHover`'s state updater, then the `insertNode` + `getFlatDataFromTree` + `slideRows`
that the invalidated `rows` memo re-runs.

### The browser harnesses

Two scripts here are not part of `npm run bench`, because that one compares three libraries
and these compare _this_ library against itself or against a fixed expectation:

- `attribution/keyboard-cost.mjs` — the method above applied in a browser: one page, both
  variants, sides alternating per trial, minimum reported. Built to answer whether composing
  the keyboard backend over the pointer one explains the "Expand a group" cell. It does not:
  0.0-0.3 ms against a ~0.9 ms gap.
- `layout/horizontal-scroll.mjs` — a pass/fail check that a row wider than the viewport can be
  scrolled to. It has to be a browser: jsdom has no layout engine, so `scrollWidth` is always 0
  there and a clipped row is invisible to `npm test`.

## Known asymmetries

Kept deliberately, and all of them flatter the other two libraries:

- `@minoru/react-dnd-treeview` is headless, so its row is a plain flex div. The
  two react-sortable-tree rows draw scaffold lines, a drag handle and a toggle,
  which is more work per row. Its per-row cost is therefore understated.
- `react-virtualized` overscans 10 rows by default and `virtua` fewer, so the
  original renders 20 rows per viewport against this fork's 13. Both are library
  defaults, and more rows means more work.
- All three run through an HTML5 drag-and-drop backend and the context-less tree
  export, so a DnD provider is present and included everywhere. **The backends are
  no longer identical**, and this is the one asymmetry that does not flatter the
  others: this fork is on `@nosferatu500/react-dnd` 19 wrapped in
  `withTreeKeyboard`, so it carries a second composed backend and a keyboard
  interaction the other two do not implement at all, while they use upstream
  `react-dnd` 16. That shows up as +1 event listener and about 1 ms on expands.
  Matching them would mean benchmarking a configuration the README no longer
  tells anyone to use.
- Row height is pinned to 62px (both react-sortable-tree defaults) and the
  viewport to 600×900 for all three, so every library shows the same ~10 rows.

## Files

| file                    | what                                                  |
| ----------------------- | ----------------------------------------------------- |
| `pack-fork.mjs`         | builds the fork and packs it to `vendor/fork.tgz`     |
| `harness/bench-core.js` | shared, dependency-free browser-side primitives       |
| `harness/*.jsx`         | React 19 adapters                                     |
| `legacy/original.jsx`   | React 16 adapter, in its own workspace for resolution |
| `compat19/`             | the original mounted on React 19                      |
| `build.mjs`             | harness bundles + bundle-size measurement             |
| `run.mjs`               | Chrome driver, writes `results.json`                  |
| `report.mjs`            | `results.json` -> `RESULTS.md`                        |
| `footprint.mjs`         | packages and disk per library                         |
| `attribution/`          | within-library A/B measurement (not run by `bench`)   |
| `layout/`               | browser checks jsdom cannot do (not run by `bench`)   |
