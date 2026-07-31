/**
 * Browser-side benchmark primitives shared by all three adapters.
 *
 * Deliberately dependency-free (plain JS, no bare imports) so the same file can
 * be bundled into the React 19 harnesses and into the React 16 harness that the
 * original react-sortable-tree needs.
 */

/**
 * Forces the pending style and layout work to happen now, so a timing taken
 * right after a synchronous React commit covers render + commit + layout rather
 * than stopping at "the DOM was mutated".
 */
export const forceLayout = (el) => el.getBoundingClientRect().height

/**
 * Times a synchronous React commit two ways.
 *
 * `flush` is the commit itself: render, DOM mutation and the layout forced right
 * after it. `painted` additionally waits until the library has rows in the DOM
 * and the browser has painted them — virtua measures its viewport from a
 * ResizeObserver, so the fork's rows land one frame after the commit while the
 * two non-virtualized-first designs emit theirs during it. Both numbers are
 * wall-clock and therefore include vsync waiting; the CPU-work figures the
 * driver collects alongside them do not.
 */
export async function timed(commit, rowCount) {
  const start = performance.now()
  commit()
  const flush = performance.now() - start
  while (rowCount() === 0) await afterPaint()
  await afterPaint()
  return { flush, painted: performance.now() - start }
}

/** Resolves after the browser has painted, returning the timestamp. */
export const afterPaint = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(() => resolve(performance.now()), 0)
    })
  })

/** One animation frame, without waiting for the post-paint task. */
export const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()))

const ROOT_COUNT = 10

/**
 * The canonical shape every library renders: ROOT_COUNT expanded groups sharing
 * `total` nodes between them. Collapsing one group therefore hides ~1/10th of
 * the rows, which is what the expand/collapse scenario measures.
 */
export function nestedTree(total, { expanded = true } = {}) {
  const childCount = total / ROOT_COUNT - 1
  return Array.from({ length: ROOT_COUNT }, (_, i) => ({
    title: `Group ${i}`,
    expanded,
    children: Array.from({ length: childCount }, (_, j) => ({
      title: `Item ${i}-${j}`,
    })),
  }))
}

/** The same tree in the flat parent-pointer form @minoru/react-dnd-treeview takes. */
export function flatTree(total) {
  const childCount = total / ROOT_COUNT - 1
  const nodes = []
  let id = 0
  for (let i = 0; i < ROOT_COUNT; i++) {
    const parent = ++id
    nodes.push({ id: parent, parent: 0, droppable: true, text: `Group ${i}` })
    for (let j = 0; j < childCount; j++) {
      nodes.push({
        id: ++id,
        parent,
        droppable: false,
        text: `Item ${i}-${j}`,
      })
    }
  }
  return nodes
}

/** Ids of the ROOT_COUNT group nodes in the flat tree, in order. */
export const flatGroupIds = (total) => {
  const childCount = total / ROOT_COUNT - 1
  return Array.from({ length: ROOT_COUNT }, (_, i) => i * (childCount + 1) + 1)
}

/**
 * The deepest scrollable element under `rootEl`. Found by inspection rather than
 * by selector so the same code works for virtua, react-virtualized and a plain
 * overflowing <ul>.
 */
export function findScroller(rootEl) {
  let best = null
  for (const el of [rootEl, ...rootEl.querySelectorAll('*')]) {
    const { overflowY } = getComputedStyle(el)
    const scrollable = overflowY === 'auto' || overflowY === 'scroll'
    if (!scrollable || el.scrollHeight <= el.clientHeight + 1) continue
    if (!best || el.scrollHeight > best.scrollHeight) best = el
  }
  return best
}

/** Records frame-to-frame deltas while a scenario runs. */
function frameMonitor() {
  const deltas = []
  let last = performance.now()
  let running = true
  const tick = (now) => {
    if (!running) return
    deltas.push(now - last)
    last = now
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  return {
    stop() {
      running = false
      // The first delta covers the gap before the sweep started.
      return deltas.slice(1)
    },
  }
}

/**
 * Scrolls from top to bottom in `steps` jumps, one animation frame apart, while
 * watching frame production. Chrome runs with vsync disabled, so a frame delta
 * approximates the work needed to produce that frame.
 */
export async function measureScroll(el, steps = 40) {
  const max = el.scrollHeight - el.clientHeight
  if (max <= 0) return null
  el.scrollTop = 0
  await afterPaint()

  const monitor = frameMonitor()
  const t0 = performance.now()
  for (let i = 1; i <= steps; i++) {
    el.scrollTop = Math.round((max * i) / steps)
    await nextFrame()
  }
  await afterPaint()
  const total = performance.now() - t0
  return { total, frames: monitor.stop() }
}

/** How much DOM the library actually materialised. */
export const domNodeCount = (rootEl) => rootEl.querySelectorAll('*').length

export function register(harness) {
  globalThis.__harness = harness
  globalThis.__harnessReady = true
}
