import React, { Children, cloneElement, ReactNode } from 'react'
import { ConnectDropTarget } from 'react-dnd'
import { TreeItem, TreeItemDropResult } from './types'

const defaultProps = {
  canDrop: false,
  draggedNode: undefined,
}

type TreePlaceholderProps = {
  children: ReactNode
  // Drop target
  connectDropTarget: ConnectDropTarget
  isOver: boolean
  canDrop: boolean
  draggedNode: TreeItem
  treeId: string
  drop: (dropResult: TreeItemDropResult) => void
}

const TreePlaceholder = (props: TreePlaceholderProps) => {
  props = { ...defaultProps, ...props }
  const { children, connectDropTarget, treeId, drop, ...otherProps } = props

  return (
    <div ref={connectDropTarget}>
      {Children.map(children, (child) =>
        cloneElement(child, {
          ...otherProps,
        })
      )}
    </div>
  )
}

export default TreePlaceholder
