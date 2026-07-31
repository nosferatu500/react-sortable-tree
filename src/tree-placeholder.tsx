import React, { Children, cloneElement, type ReactNode } from 'react'
import type { ConnectDropTarget } from 'react-dnd'
import type { TreeItem, TreeItemDropResult } from './types'

type TreePlaceholderProps = {
  children: ReactNode
  // Drop target
  connectDropTarget: ConnectDropTarget
  isOver: boolean
  canDrop: boolean
  draggedNode?: TreeItem
  treeId: string
  drop: (dropResult: TreeItemDropResult) => void
}

const TreePlaceholder = ({
  canDrop = false,
  draggedNode = undefined,
  children,
  connectDropTarget,
  treeId: _treeId,
  drop: _drop,
  ...otherProps
}: TreePlaceholderProps): React.JSX.Element => {
  return (
    <div ref={connectDropTarget as unknown as React.Ref<HTMLDivElement>}>
      {Children.map(children, (child) =>
        cloneElement(child as React.ReactElement<Record<string, unknown>>, {
          canDrop,
          draggedNode,
          ...otherProps,
        })
      )}
    </div>
  )
}

export default TreePlaceholder
