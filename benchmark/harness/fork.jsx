import React, { useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { DndProvider } from '@nosferatu500/react-dnd'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import {
  SortableTreeWithoutDndContext,
  withTreeKeyboard,
} from '@nosferatu500/react-sortable-tree'
import '@nosferatu500/react-sortable-tree/style.css'
import {
  afterPaint,
  domNodeCount,
  findScroller,
  forceLayout,
  measureScroll,
  nestedTree,
  register,
  timed,
} from './bench-core.js'
import { createStore } from './store.js'
import { VIEWPORT, ROW_HEIGHT } from './layout.js'

// What the README tells consumers who supply their own provider to do, so the
// page measures the keyboard-capable configuration rather than a pointer-only
// one that no longer matches the documented setup.
const backend = withTreeKeyboard(HTML5Backend)

const store = createStore([])

function App() {
  const treeData = useSyncExternalStore(store.subscribe, store.get)
  return (
    <div style={VIEWPORT}>
      <SortableTreeWithoutDndContext
        treeData={treeData}
        onChange={store.set}
        rowHeight={ROW_HEIGHT}
        aria-label="Benchmark tree"
      />
    </div>
  )
}

const container = document.getElementById('root')
const rowCount = () => container.querySelectorAll('[role="treeitem"]').length
let root = null

const setFirstGroupExpanded = (expanded) =>
  timed(() => {
    const next = store
      .get()
      .map((node, i) => (i === 0 ? { ...node, expanded } : node))
    flushSync(() => store.set(next))
    forceLayout(container)
  }, rowCount)

register({
  name: 'fork',

  mount(total) {
    store.set(nestedTree(total))
    root = createRoot(container)
    return timed(() => {
      flushSync(() =>
        root.render(
          <DndProvider backend={backend}>
            <App />
          </DndProvider>
        )
      )
      forceLayout(container)
    }, rowCount)
  },

  async reset() {
    root?.unmount()
    root = null
    container.innerHTML = ''
    store.set([])
    await afterPaint()
  },

  collapseFirstGroup: () => setFirstGroupExpanded(false),
  expandFirstGroup: () => setFirstGroupExpanded(true),
  domNodes: () => domNodeCount(container),
  rows: rowCount,
  scroll: (steps) => measureScroll(findScroller(container), steps),
})
