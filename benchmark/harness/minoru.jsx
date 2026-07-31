import React, { useRef, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { Tree } from '@minoru/react-dnd-treeview'
import {
  afterPaint,
  domNodeCount,
  findScroller,
  flatGroupIds,
  flatTree,
  forceLayout,
  measureScroll,
  register,
  timed,
} from './bench-core.js'
import { createStore } from './store.js'
import { VIEWPORT, ROW_HEIGHT } from './layout.js'

const store = createStore([])
let treeRef = null

// The library is headless, so the row is ours to write. Kept to the same height
// as the other two libraries' default row so every viewport shows 9-10 rows.
const Row = (node, { depth, isOpen, hasChild, onToggle }) => (
  <div
    style={{
      height: ROW_HEIGHT,
      display: 'flex',
      alignItems: 'center',
      paddingInlineStart: depth * 44,
      boxSizing: 'border-box',
    }}>
    {hasChild && (
      <button type="button" onClick={onToggle}>
        {isOpen ? '-' : '+'}
      </button>
    )}
    <span>{node.text}</span>
  </div>
)

function App() {
  const tree = useSyncExternalStore(store.subscribe, store.get)
  const ref = useRef(null)
  treeRef = ref
  return (
    <div style={VIEWPORT}>
      <Tree
        ref={ref}
        tree={tree}
        rootId={0}
        render={Row}
        onDrop={store.set}
        initialOpen
        // Animating the height on expand would make the toggle timing measure a
        // framer-motion transition instead of the render.
        enableAnimateExpand={false}
      />
    </div>
  )
}

const container = document.getElementById('root')
const rowCount = () => container.querySelectorAll('li').length
let root = null
let groupIds = []

const toggleFirstGroup = (open) =>
  timed(() => {
    flushSync(() => {
      if (open) treeRef.current.open(groupIds[0])
      else treeRef.current.close(groupIds[0])
    })
    forceLayout(container)
  }, rowCount)

register({
  name: 'minoru',

  mount(total) {
    groupIds = flatGroupIds(total)
    store.set(flatTree(total))
    root = createRoot(container)
    return timed(() => {
      flushSync(() =>
        root.render(
          <DndProvider backend={HTML5Backend}>
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
    treeRef = null
    await afterPaint()
  },

  collapseFirstGroup: () => toggleFirstGroup(false),
  expandFirstGroup: () => toggleFirstGroup(true),
  domNodes: () => domNodeCount(container),
  rows: rowCount,
  scroll: (steps) => measureScroll(findScroller(container), steps),
})
