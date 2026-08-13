import React from 'react'
import type { TreeItem, UnknownNodeData } from './types'
import { classnames } from './utils/classnames'
import './placeholder-renderer-default.css'

export interface PlaceholderRendererProps<TData = UnknownNodeData> {
  isOver: boolean
  canDrop: boolean
  draggedNode?: TreeItem<TData>
}

const PlaceholderRendererDefault: React.FC<PlaceholderRendererProps> = ({
  isOver = false,
  canDrop = false,
  draggedNode: _draggedNode,
}) => {
  return (
    <div
      className={classnames(
        'rst__placeholder',
        canDrop ? 'rst__placeholderLandingPad' : '',
        canDrop && !isOver ? 'rst__placeholderCancelPad' : ''
      )}
    />
  )
}

export default PlaceholderRendererDefault
