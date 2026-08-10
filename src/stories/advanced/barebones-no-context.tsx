import { DndProvider } from '@nosferatu500/react-dnd'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import React, { useState } from 'react'
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
        <SortableTree
          aria-label="Tree inside an existing dnd context"
          treeData={treeData}
          onChange={setTreeData}
        />
      </DndProvider>
    </div>
  )
}

export default BarebonesNoContext
