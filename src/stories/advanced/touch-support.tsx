import { composeBackends } from '@nosferatu500/dnd-core'
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
// All three gestures at once, which needs no feature detection at all.
//
// A provider takes one backend, so supporting a mouse and a finger used to mean
// picking between them up front — and picking wrong on a hybrid laptop, which
// reports touch support and is usually driven by a trackpad. `composeBackends`
// runs both: HTML5 answers `dragstart` and Touch answers `touchstart`, so the
// two never contend for the same gesture (they would only overlap under
// TouchBackend's `enableMouseEvents`, which is left off).
//
// `SortableTree` composes the keyboard backend itself, but this story brings its
// own provider — so it composes it too, or the tree is silently undraggable by
// keyboard. Nesting is fine: `withKeyboard` flattens a composite it is handed.
const dndBackend = withTreeKeyboard(composeBackends(HTML5Backend, TouchBackend))

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
