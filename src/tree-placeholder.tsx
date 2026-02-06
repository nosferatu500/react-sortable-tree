import React, { Children, cloneElement, ReactNode } from 'react'
import { ConnectDropTarget } from 'react-dnd'
import { TreeItem, TreeItemDropResult } from './types'

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
  treeId,
  drop,
  ...otherProps
}: TreePlaceholderProps) => {
  return (
    <div ref={connectDropTarget as unknown as React.Ref<HTMLDivElement>}>
      {Children.map(children, (child) =>
        cloneElement(child as React.ReactElement<any>, {
          canDrop,
          draggedNode,
          ...otherProps,
        })
      )}
    </div>
  )
}

export default TreePlaceholder
