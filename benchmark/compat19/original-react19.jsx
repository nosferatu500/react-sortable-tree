/**
 * Mounts the original react-sortable-tree against React 19 and reports whatever
 * happens, so the compatibility claim in the results table is measured rather
 * than assumed. Installed with --legacy-peer-deps; its peer range stops at 16.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import SortableTree from 'react-sortable-tree'
import 'react-sortable-tree/style.css'

const treeData = [
  { title: 'Group', expanded: true, children: [{ title: 'Item' }] },
]

function App() {
  const [tree, setTree] = React.useState(treeData)
  return (
    <div style={{ height: 300, width: 700 }}>
      <SortableTree treeData={tree} onChange={setTree} />
    </div>
  )
}

const container = document.getElementById('root')
globalThis.__result = { mounted: false, error: null, rows: 0 }

try {
  createRoot(container).render(<App />)
} catch (error) {
  globalThis.__result.error = `${error.name}: ${error.message}`
}

requestAnimationFrame(() => {
  setTimeout(() => {
    globalThis.__result.rows = container.querySelectorAll('.rst__node').length
    globalThis.__result.mounted = globalThis.__result.rows > 0
    globalThis.__done = true
  }, 200)
})

globalThis.addEventListener('error', (event) => {
  globalThis.__result.error ??= `${event.message}`
})
