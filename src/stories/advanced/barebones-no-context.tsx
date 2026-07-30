import React, { useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import {
  SortableTreeWithoutDndContext as SortableTree,
  type TreeItem,
} from '../../../src'

const BarebonesNoContext: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeItem[]>([
    { title: 'Chicken', expanded: true, children: [{ title: 'Egg' }] },
  ])

  return (
    <div style={{ height: 300, width: 700 }}>
      <DndProvider backend={HTML5Backend}>
        <SortableTree treeData={treeData} onChange={setTreeData} />
      </DndProvider>
    </div>
  )
}

export default BarebonesNoContext
