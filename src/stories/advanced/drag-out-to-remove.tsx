import React, { useState } from 'react'
import { DndProvider, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
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
      // react-dnd's connectors are callable refs but aren't structurally a
      // React.Ref, so they need a cast — same as src/node-renderer-default.tsx.
      ref={drop as unknown as React.Ref<HTMLDivElement>}
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
