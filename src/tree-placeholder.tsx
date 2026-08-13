import type { ConnectDropTarget } from '@nosferatu500/react-dnd'
import React, { Children, cloneElement, type ReactNode } from 'react'
import type { TreeItem, TreeItemDropResult, UnknownNodeData } from './types'

type TreePlaceholderProps<TData = UnknownNodeData> = {
  children: ReactNode
  // Drop target
  connectDropTarget: ConnectDropTarget
  isOver: boolean
  canDrop: boolean
  draggedNode?: TreeItem<TData>
  treeId: string
  drop: (dropResult: TreeItemDropResult<TData>) => void
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
    <div ref={connectDropTarget}>
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
