import { DndProvider } from '@nosferatu500/react-dnd'
import { HTML5Backend } from '@nosferatu500/react-dnd-html5-backend'
import { TouchBackend } from '@nosferatu500/react-dnd-touch-backend'
import React, { useState } from 'react'
import {
  SortableTreeWithoutDndContext as SortableTree,
  type TreeItem,
  withTreeKeyboard,
} from '../../../src'

// https://stackoverflow.com/a/4819886/1601953
const isTouchDevice = !!(
  'ontouchstart' in globalThis || navigator.maxTouchPoints
)
// `SortableTree` composes the keyboard backend itself, but this story brings its
// own provider — so it composes it too. Swapping in TouchBackend without this
// would silently leave the tree undraggable by keyboard.
const dndBackend = withTreeKeyboard(isTouchDevice ? TouchBackend : HTML5Backend)

const TouchSupport: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeItem[]>([
    { title: 'Chicken', expanded: true, children: [{ title: 'Egg' }] },
  ])

  return (
    <DndProvider backend={dndBackend}>
      <div>
        <span>
          This is {!isTouchDevice && 'not '}a touch-supporting browser
        </span>

        <div style={{ height: 300, width: 700 }}>
          <SortableTree
            aria-label="Touch-draggable tree"
            treeData={treeData}
            onChange={setTreeData}
          />
        </div>
      </div>
    </DndProvider>
  )
}

export default TouchSupport
