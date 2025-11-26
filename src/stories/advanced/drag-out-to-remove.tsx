import React, { Component, useState } from 'react'
import { DndProvider, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { SortableTreeWithoutDndContext as SortableTree } from '../../../src'

// -------------------------
// Create an drop target component that can receive the nodes
// https://react-dnd.github.io/react-dnd/docs-drop-target.html
// -------------------------
// This type must be assigned to the tree via the `dndType` prop as well
const trashAreaType = 'yourNodeType'

const TrashAreaComponent = ({ children }: { children: React.ReactNode }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: trashAreaType,
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return undefined
      }

      return { ...monitor.getItem(), treeId: 'trash' }
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
  const [treeData, setTreeData] = useState([
    { title: '1' },
    { title: '2' },
    { title: '3' },
    { title: '4', expanded: true, children: [{ title: '5' }] },
  ]);

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

export default DragOutToRemove;
