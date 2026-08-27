/**
 * The reported shape: a deeply nested tree in a container narrower than its
 * widest row, with a button at the end of each row.
 *
 * Each level indents by `scaffoldBlockPxWidth`, so by level 6 the row content
 * starts well inside the container and its right-hand button falls outside it.
 * That button is what the check tries to reach.
 */
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SortableTree } from '@rst'
import '@rst/style.css'

const deep = (depth) =>
  depth === 0
    ? [{ title: 'Papa Rabbit — the last one, with an action button' }]
    : [
        {
          title: `Baby Rabbit level ${7 - depth} with a fairly long label`,
          expanded: true,
          children: deep(depth - 1),
        },
      ]

function App() {
  const [treeData, setTreeData] = useState(deep(6))
  return (
    <div id="box" style={{ width: 620, height: 380, border: '1px solid #ccc' }}>
      <SortableTree
        aria-label="Deeply nested tree"
        treeData={treeData}
        onChange={setTreeData}
        generateNodeProps={() => ({
          buttons: [
            <button key="act" type="button" className="probe-button">
              act
            </button>,
          ],
        })}
      />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
