/**
 * Attribution page for one open question: does composing the keyboard backend
 * over the pointer one account for the extra ~1 ms the cross-library benchmark
 * measures on "Expand a group"?
 *
 * Deliberately not part of `npm run bench`. That benchmark compares three
 * libraries and has to render each the way a consumer would; this page renders
 * *the same* library twice, changing only the backend, which is the only way to
 * attribute a cost to the composition rather than to the tree.
 *
 * Both variants live on one page and are mounted one at a time, so the runner can
 * alternate them trial by trial — JIT state and GC drift then hit both sides
 * equally, which single-shot timings do not. See ../README.md, "Method: proving a
 * before/after".
 */
import { DndProvider } from '@nosferatu500/react-dnd'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import {
  SortableTreeWithoutDndContext,
  withTreeKeyboard,
} from '@nosferatu500/react-sortable-tree'
import React, { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import '@nosferatu500/react-sortable-tree/style.css'
import {
  afterPaint,
  forceLayout,
  nestedTree,
  register,
  timed,
} from '../harness/bench-core.js'
import { ROW_HEIGHT, VIEWPORT } from '../harness/layout.js'
import { createStore } from '../harness/store.js'

// Both built once, at module scope: a new backend factory identity tears down and
// rebuilds the whole drag-and-drop manager, which would land in the measurement.
const BACKENDS = {
  keyboard: withTreeKeyboard(HTML5Backend),
  pointer: HTML5Backend,
}

const store = createStore([])
const container = document.getElementById('root')
const rowCount = () => container.querySelectorAll('[role="treeitem"]').length
let root = null

function App() {
  const treeData = useSyncExternalStore(store.subscribe, store.get)
  return (
    <div style={VIEWPORT}>
      <SortableTreeWithoutDndContext
        treeData={treeData}
        onChange={store.set}
        rowHeight={ROW_HEIGHT}
        aria-label="Attribution tree"
      />
    </div>
  )
}

const setFirstGroupExpanded = (expanded) =>
  timed(() => {
    const next = store
      .get()
      .map((node, i) => (i === 0 ? { ...node, expanded } : node))
    flushSync(() => store.set(next))
    forceLayout(container)
  }, rowCount)

register({
  name: 'keyboard-cost',

  /** Mounts one variant with the first group collapsed, ready to expand. */
  async mount(variant, total) {
    const backend = BACKENDS[variant]
    if (!backend) throw new Error(`unknown variant ${variant}`)

    store.set(nestedTree(total))
    root = createRoot(container)
    flushSync(() =>
      root.render(
        <DndProvider backend={backend}>
          <App />
        </DndProvider>
      )
    )
    forceLayout(container)
    await afterPaint()

    // Collapse first, outside the measurement, so the timed call below is an
    // expand from a settled tree rather than the mount.
    await setFirstGroupExpanded(false)
    await afterPaint()
  },

  /**
   * `cycles` expand/collapse pairs, returning the total commit time of the
   * expands alone.
   *
   * One expand is not measurable: `performance.now()` is clamped to 100µs and a
   * single commit lands at 1–2 ms, so the reading quantises to a handful of
   * values and any real difference disappears into the step. Summing many and
   * dividing recovers the resolution — the same reason the Node-side harness in
   * ../README.md takes an iteration count.
   */
  async expandRepeatedly(cycles) {
    let total = 0
    let expandedHeight = 0
    for (let i = 0; i < cycles; i += 1) {
      const expanded = await setFirstGroupExpanded(true)
      total += expanded.flush
      // Read while it is actually expanded: every cycle ends collapsed, so a
      // caller measuring afterwards would see the collapsed height and conclude
      // nothing had happened.
      expandedHeight = this.scrollHeight()
      // Collapsing again is what makes the next expand real work rather than a
      // no-op, and is deliberately left out of the total.
      await setFirstGroupExpanded(false)
    }
    return { flush: total / cycles, expandedHeight }
  },

  async reset() {
    root?.unmount()
    root = null
    container.innerHTML = ''
    store.set([])
    await afterPaint()
  },

  /**
   * Rows in the DOM, and rows the virtualizer believes exist.
   *
   * The first stays flat across an expand — virtua renders a fixed window — so it
   * cannot show that the expand did anything. `scrollHeight` can: it tracks the
   * whole flattened list, so it is the check that this page is measuring real
   * work rather than a no-op.
   */
  rows: rowCount,
  scrollHeight() {
    const scroller = container.querySelector('#vlist') ?? container.firstChild
    return scroller?.scrollHeight ?? 0
  },
})
