import { DndProvider, useDrag } from '@nosferatu500/react-dnd'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import React, { useState } from 'react'
import {
  SortableTreeWithoutDndContext as SortableTree,
  type TreeItem,
  withTreeKeyboard,
} from '../../../src'

// Own provider, so compose the keyboard backend explicitly.
const dndBackend = withTreeKeyboard(HTML5Backend)

// -------------------------
// Create an drag source component that can be dragged into the tree
// https://react-dnd.github.io/react-dnd/docs-drag-source.html
// -------------------------
// This type must be assigned to the tree via the `dndType` prop as well
const externalNodeType = 'yourNodeType'

const YourExternalNodeComponent = ({ node }: { node: { title: string } }) => {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: externalNodeType,
      item: { node: { ...node } },
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [node]
  )

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
  const [treeData, setTreeData] = useState<TreeItem[]>([
    { title: 'Mama Rabbit' },
    { title: 'Papa Rabbit' },
  ])

  return (
    <DndProvider backend={dndBackend}>
      <div>
        <div style={{ height: 300, width: 700 }}>
          <SortableTree
            aria-label="Drop target tree"
            treeData={treeData}
            onChange={setTreeData}
            dndType={externalNodeType}
          />
        </div>
        <br />
        <YourExternalNodeComponent node={{ title: 'Baby Rabbit' }} /> ← drag
        this
      </div>
    </DndProvider>
  )
}

export default ExternalNode
