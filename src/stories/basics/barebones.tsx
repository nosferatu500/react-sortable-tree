import React, { useState } from 'react'
import { SortableTree, type TreeItem } from '../../../src'
// In your own app, import the stylesheet once, anywhere:
// import '@nosferatu500/react-sortable-tree/style.css'
// (These stories import the component from source, so Vite picks the CSS up
// through the per-component imports in src/.)

const data = [
  { title: 'Chicken', expanded: true, children: [{ title: 'Egg' }] },
]

const Barebones: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeItem[]>(data)

  return (
    <div style={{ height: 300, width: 700 }}>
      <SortableTree treeData={treeData} onChange={setTreeData} />
    </div>
  )
}

export default Barebones
