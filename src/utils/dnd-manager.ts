// @ts-nocheck

import { DragSource as dragSource, DropTarget as dropTarget } from 'react-dnd'
import { getDepth } from './tree-data-utils'

let rafId = 0

const nodeDragSourcePropInjection = (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  connectDragPreview: connect.dragPreview(),
  isDragging: monitor.isDragging(),
  didDrop: monitor.didDrop(),
})

export const wrapSource = (el, startDrag, endDrag, dndType) => {
  const nodeDragSource = {
    beginDrag: (props) => {
      startDrag(props)

      return {
        node: props.node,
        parentNode: props.parentNode,
        path: props.path,
        treeIndex: props.treeIndex,
        treeId: props.treeId,
      }
    },

    endDrag: (props, monitor) => {
      endDrag(monitor.getDropResult())
    },

    isDragging: (props, monitor) => {
      const dropTargetNode = monitor.getItem().node
      const draggedNode = props.node

      return draggedNode === dropTargetNode
    },
  }

  return dragSource(dndType, nodeDragSource, nodeDragSourcePropInjection)(el)
}

const propInjection = (connect, monitor) => {
  const dragged = monitor.getItem()
  return {
    connectDropTarget: connect.dropTarget(),
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop(),
    draggedNode: dragged ? dragged.node : undefined,
  }
}

export const wrapPlaceholder = (el, treeId, drop, dndType) => {
  const placeholderDropTarget = {
    drop: (dropTargetProps, monitor) => {
      const { node, path, treeIndex } = monitor.getItem()
      const result = {
        node,
        path,
        treeIndex,
        treeId,
        minimumTreeIndex: 0,
        depth: 0,
      }

      drop(result)

      return result
    },
  }

  return dropTarget(dndType, placeholderDropTarget, propInjection)(el)
}

const getTargetDepth = (
  dropTargetProps,
  monitor,
  component,
  canNodeHaveChildren,
  treeId,
  maxDepth
) => {
  let dropTargetDepth = 0

  const rowAbove = dropTargetProps.getPrevRow()
  if (rowAbove) {
    const { node } = rowAbove
    let { path } = rowAbove
    const aboveNodeCannotHaveChildren = !canNodeHaveChildren(node)
    if (aboveNodeCannotHaveChildren) {
      path = path.slice(0, -1)
    }

    // Limit the length of the path to the deepest possible
    dropTargetDepth = Math.min(path.length, dropTargetProps.path.length)
  }

  let blocksOffset
  let dragSourceInitialDepth = (monitor.getItem().path || []).length

  // When adding node from external source
  if (monitor.getItem().treeId !== treeId) {
    // Ignore the tree depth of the source, if it had any to begin with
    dragSourceInitialDepth = 0

    if (component) {
      const relativePosition = component.node.getBoundingClientRect()
      const leftShift =
        monitor.getSourceClientOffset().x - relativePosition.left
      blocksOffset = Math.round(
        leftShift / dropTargetProps.scaffoldBlockPxWidth
      )
    } else {
      blocksOffset = dropTargetProps.path.length
    }
  } else {
    blocksOffset = Math.round(
      monitor.getDifferenceFromInitialOffset().x /
        dropTargetProps.scaffoldBlockPxWidth
    )
  }

  let targetDepth = Math.min(
    dropTargetDepth,
    Math.max(0, dragSourceInitialDepth + blocksOffset - 1)
  )

  // If a maxDepth is defined, constrain the target depth
  if (typeof maxDepth !== 'undefined' && maxDepth !== undefined) {
    const draggedNode = monitor.getItem().node
    const draggedChildDepth = getDepth(draggedNode)

    targetDepth = Math.max(
      0,
      Math.min(targetDepth, maxDepth - draggedChildDepth - 1)
    )
  }

  return targetDepth
}

const canDrop = (
  dropTargetProps,
  monitor,
  canNodeHaveChildren,
  treeId,
  maxDepth,
  treeRefcanDrop
) => {
  if (!monitor.isOver()) {
    return false
  }

  const rowAbove = dropTargetProps.getPrevRow()
  const abovePath = rowAbove ? rowAbove.path : []
  const aboveNode = rowAbove ? rowAbove.node : {}
  const targetDepth = getTargetDepth(
    dropTargetProps,
    monitor,
    undefined,
    canNodeHaveChildren,
    treeId,
    maxDepth
  )

  // Cannot drop if we're adding to the children of the row above and
  //  the row above is a function
  if (
    targetDepth >= abovePath.length &&
    typeof aboveNode.children === 'function'
  ) {
    return false
  }

  if (typeof treeRefcanDrop === 'function') {
    const { node } = monitor.getItem()

    return treeRefcanDrop({
      node,
      prevPath: monitor.getItem().path,
      prevParent: monitor.getItem().parentNode,
      prevTreeIndex: monitor.getItem().treeIndex, // Equals -1 when dragged from external tree
      nextPath: dropTargetProps.children.props.path,
      nextParent: dropTargetProps.children.props.parentNode,
      nextTreeIndex: dropTargetProps.children.props.treeIndex,
    })
  }

  return true
}

export const wrapTarget = (
  el,
  canNodeHaveChildren,
  treeId,
  maxDepth,
  treeRefcanDrop,
  drop,
  dragHover,
  dndType
) => {
  const nodeDropTarget = {
    drop: (dropTargetProps, monitor, component) => {
      const result = {
        node: monitor.getItem().node,
        path: monitor.getItem().path,
        treeIndex: monitor.getItem().treeIndex,
        treeId,
        minimumTreeIndex: dropTargetProps.treeIndex,
        depth: getTargetDepth(
          dropTargetProps,
          monitor,
          component,
          canNodeHaveChildren,
          treeId,
          maxDepth
        ),
      }

      drop(result)

      return result
    },

    hover: (dropTargetProps, monitor, component) => {
      const targetDepth = getTargetDepth(
        dropTargetProps,
        monitor,
        component,
        canNodeHaveChildren,
        treeId,
        maxDepth
      )
      const draggedNode = monitor.getItem().node
      const needsRedraw =
        // Redraw if hovered above different nodes
        dropTargetProps.node !== draggedNode ||
        // Or hovered above the same node but at a different depth
        targetDepth !== dropTargetProps.path.length - 1

      if (!needsRedraw) {
        return
      }

      // throttle `dragHover` work to available animation frames
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const item = monitor.getItem()
        // skip if drag already ended before the animation frame
        if (!item || !monitor.isOver()) {
          return
        }
        dragHover({
          node: draggedNode,
          path: item.path,
          minimumTreeIndex: dropTargetProps.listIndex,
          depth: targetDepth,
        })
      })
    },

    canDrop: (dropTargetProps, monitor) =>
      canDrop(
        dropTargetProps,
        monitor,
        canNodeHaveChildren,
        treeId,
        maxDepth,
        treeRefcanDrop
      ),
  }

  return dropTarget(dndType, nodeDropTarget, propInjection)(el)
}
