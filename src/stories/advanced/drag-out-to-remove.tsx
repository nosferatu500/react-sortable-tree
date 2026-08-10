import { DndProvider, useDrop } from '@nosferatu500/react-dnd'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import React, { useState } from 'react'
import {
  SortableTreeWithoutDndContext as SortableTree,
  type TreeItem,
} from '../../../src'

// -------------------------
// Create an drop target component that can receive the nodes
// https://react-dnd.github.io/react-dnd/docs-drop-target.html
// -------------------------
// This type must be assigned to the tree via the `dndType` prop as well
const trashAreaType = 'yourNodeType'

// Shape the tree puts into the drag layer. Declaring it lets useDrop type
// `item`, instead of it arriving as `unknown` and blocking the spread below.
type TreeDragItem = {
  node: TreeItem
  path: number[]
  treeIndex: number
  treeId: string
}

const TrashAreaComponent = ({ children }: { children: React.ReactNode }) => {
  const [{ isOver }, drop] = useDrop<
    TreeDragItem,
    TreeDragItem | undefined,
    { isOver: boolean }
  >(() => ({
    accept: trashAreaType,
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return undefined
      }

      return { ...item, treeId: 'trash' }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  }))

  return (
    <div
      ref={drop}
      style={{
        height: '100vh',
        padding: 50,
        background: isOver ? 'pink' : 'transparent',
      }}>
      {children}
    </div>
  )
}

const DragOutToRemove: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeItem[]>([
    { title: '1' },
    { title: '2' },
    { title: '3' },
    { title: '4', expanded: true, children: [{ title: '5' }] },
  ])

  return (
    <DndProvider backend={HTML5Backend}>
      <div>
        <TrashAreaComponent>
          <div style={{ height: 300, width: 700 }}>
            <SortableTree
              aria-label="Tree you can drag nodes out of"
              treeData={treeData}
              onChange={setTreeData}
              dndType={trashAreaType}
            />
          </div>
        </TrashAreaComponent>
      </div>
    </DndProvider>
  )
}

export default DragOutToRemove
