import React from 'react'
import { classnames } from './utils/classnames'
import './placeholder-renderer-default.css'

export interface PlaceholderRendererProps {
  isOver: boolean
  canDrop: boolean
}

const defaultProps = {
  isOver: false,
  canDrop: false,
}

const PlaceholderRendererDefault: React.FC<PlaceholderRendererProps> = (
  props
) => {
  props = { ...defaultProps, ...props }
  const { canDrop, isOver } = props

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
