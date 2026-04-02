import React, { Component, useState } from 'react'
import { DndProvider, useDrag } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { SortableTreeWithoutDndContext as SortableTree } from '../../../src'

// -------------------------
// Create an drag source component that can be dragged into the tree
// https://react-dnd.github.io/react-dnd/docs-drag-source.html
// -------------------------
// This type must be assigned to the tree via the `dndType` prop as well
const externalNodeType = 'yourNodeType'

const YourExternalNodeComponent = ({ node }: { node: { title: string } }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: externalNodeType,
    item: { node: { ...node } },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [node])

  return (
    <div
      ref={drag}
      style={{
        display: 'inline-block',
        padding: '3px 5px',
        background: 'blue',
        color: 'white',
        opacity: isDragging ? 0.5 : 1,
        cursor: 'move',
      }}>
      {node.title}
    </div>
  )
}

const ExternalNode: React.FC = () => {
  const [treeData, setTreeData] = useState([
    { title: 'Mama Rabbit' },
    { title: 'Papa Rabbit' }
  ]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div>
        <div style={{ height: 300, width: 700 }}>
          <SortableTree
            treeData={treeData}
            onChange={setTreeData}
            dndType={externalNodeType}
          />
        </div>
        <br />
        <YourExternalNodeComponent node={{ title: 'Baby Rabbit' }} /> ← drag this
      </div>
    </DndProvider>
  )
}

export default ExternalNode;
