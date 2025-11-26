import React, { Children, cloneElement } from 'react'
import { ConnectDropTarget } from 'react-dnd'
import { TreeItem } from './types'

const defaultProps = {
  canDrop: false,
  draggedNode: undefined,
}

type TreePlaceholderProps = {
  children: any
  // Drop target
  connectDropTarget: ConnectDropTarget
  isOver: boolean
  canDrop: boolean
  draggedNode: TreeItem
  treeId: string
  drop: any
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
