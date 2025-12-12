import React, { Ref, useCallback, useLayoutEffect, useRef } from 'react'
import {
  ConnectDragSource,
  ConnectDropTarget,
  DropTargetMonitor,
  useDrag,
  useDrop,
} from 'react-dnd'
import { TreeItem } from '../types'
import { getDepth } from './tree-data-utils'

// Helper to avoid SSR warnings if used with Next.js/Gatsby
const useIsomorphicLayoutEffect =
  globalThis.window == undefined ? React.useEffect : useLayoutEffect

interface DragItem {
  node: TreeItem
  path: number[]
  treeIndex: number
  treeId: string
  parentNode?: TreeItem
}

interface DropResult {
  node: TreeItem
  path: number[]
  treeIndex: number
  treeId: string
  minimumTreeIndex: number
  depth: number
  parentNode?: TreeItem
}

/**
 * Safe Ref Merger
 * Combines multiple refs (function refs or object refs) into one.
 * Uses the refs array itself as dependency to ensure stability.
 */
function useCombinedRefs<T>(...refs: (Ref<T> | undefined)[]) {
  return useCallback(
    (handle: T | null) => {
      for (const ref of refs) {
        if (!ref) continue
        if (typeof ref === 'function') {
          ref(handle)
        } else {
          ;(ref as React.RefObject<T | null>).current = handle
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refs // Pass the array directly to avoid regeneration on every render
  )
}

export const wrapSource = (
  Component: React.ComponentType<any>,
  startDrag: (props: any) => void,
  endDrag: (dropResult: DropResult | null) => void,
  dndType: string
) => {
  const DraggableSource: React.FC<any> = (props) => {
    // React 18: Use useLayoutEffect to ensure props are fresh
    // BEFORE any drag event callbacks fire.
    const propsRef = useRef(props)
    useIsomorphicLayoutEffect(() => {
      propsRef.current = props
    })

    const [{ isDragging }, drag, preview] = useDrag(
      () => ({
        type: dndType,
        item: () => {
          // Always read from ref to get latest state without re-running useDrag
          const currentProps = propsRef.current
          startDrag(currentProps)
          return {
            node: currentProps.node,
            parentNode: currentProps.parentNode,
            path: currentProps.path,
            treeIndex: currentProps.treeIndex,
            treeId: currentProps.treeId,
          }
        },
        end: (_item, monitor) => {
          endDrag(monitor.getDropResult() as DropResult)
        },
        collect: (monitor) => ({
          isDragging: monitor.isDragging(),
        }),
      }),
      [dndType] // Only recreate if type changes
    )

    return (
      <Component
        {...props}
        connectDragSource={drag as ConnectDragSource}
        connectDragPreview={preview}
        isDragging={isDragging}
        didDrop={false}
      />
    )
  }
  return DraggableSource
}

export const wrapPlaceholder = (
  Component: React.ComponentType<any>,
  treeId: string,
  drop: (dropResult: DropResult) => void,
  dndType: string
) => {
  const DroppablePlaceholder: React.FC<any> = (props) => {
    const [{ isOver, canDrop }, dropRef] = useDrop({
      accept: dndType,
      drop: (item: DragItem, _monitor) => {
        const { node, path, treeIndex } = item
        const result: DropResult = {
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
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    })

    return (
      <Component
        {...props}
        connectDropTarget={dropRef as ConnectDropTarget}
        isOver={isOver}
        canDrop={canDrop}
      />
    )
  }
  return DroppablePlaceholder
}

const getTargetDepth = (
  dropTargetProps: any,
  monitor: DropTargetMonitor,
  componentRef: React.RefObject<HTMLElement>,
  canNodeHaveChildren: (node: TreeItem) => boolean,
  treeId: string,
  maxDepth?: number
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
    dropTargetDepth = Math.min(path.length, dropTargetProps.path.length)
  }

  let blocksOffset
  let dragSourceInitialDepth = ((monitor.getItem() as DragItem).path || [])
    .length

  if ((monitor.getItem() as DragItem).treeId === treeId) {
    const direction = dropTargetProps.rowDirection === 'rtl' ? -1 : 1
    const diff = monitor.getDifferenceFromInitialOffset()
    const x = diff ? diff.x : 0
    blocksOffset = Math.round(
      (direction * x) / dropTargetProps.scaffoldBlockPxWidth
    )
  } else {
    dragSourceInitialDepth = 0
    if (componentRef.current) {
      const relativePosition = componentRef.current.getBoundingClientRect()
      const clientOffset = monitor.getSourceClientOffset()
      const leftShift = clientOffset
        ? clientOffset.x - relativePosition.left
        : 0
      blocksOffset = Math.round(
        leftShift / dropTargetProps.scaffoldBlockPxWidth
      )
    } else {
      blocksOffset = dropTargetProps.path.length
    }
  }

  let targetDepth = Math.min(
    dropTargetDepth,
    Math.max(0, dragSourceInitialDepth + blocksOffset - 1)
  )

  if (maxDepth !== undefined) {
    const draggedNode = (monitor.getItem() as DragItem).node
    const draggedChildDepth = getDepth(draggedNode)
    targetDepth = Math.max(
      0,
      Math.min(targetDepth, maxDepth - draggedChildDepth - 1)
    )
  }

  return targetDepth
}

const canDrop = (
  dropTargetProps: any,
  monitor: DropTargetMonitor,
  canNodeHaveChildren: (node: TreeItem) => boolean,
  treeId: string,
  maxDepth: number | undefined,
  treeRefCanDrop: ((args: any) => boolean) | undefined
) => {
  if (!monitor.isOver()) {
    return false
  }
  const rowAbove = dropTargetProps.getPrevRow()
  const abovePath = rowAbove ? rowAbove.path : []
  const aboveNode = rowAbove ? rowAbove.node : {}

  const targetDepth = dropTargetProps.path.length - 1

  if (
    targetDepth >= abovePath.length &&
    typeof aboveNode.children === 'function'
  ) {
    return false
  }

  if (typeof treeRefCanDrop === 'function') {
    const { node } = monitor.getItem() as DragItem
    return treeRefCanDrop({
      node,
      prevPath: (monitor.getItem() as DragItem).path,
      prevParent: (monitor.getItem() as DragItem).parentNode,
      prevTreeIndex: (monitor.getItem() as DragItem).treeIndex,
      nextPath: dropTargetProps.path,
      nextParent: dropTargetProps.parentNode,
      nextTreeIndex: dropTargetProps.treeIndex,
    })
  }
  return true
}

export const wrapTarget = (
  Component: React.ComponentType<any>,
  canNodeHaveChildren: (node: TreeItem) => boolean,
  treeId: string,
  maxDepth: number | undefined,
  treeRefCanDrop: ((args: any) => boolean) | undefined,
  drop: (dropResult: DropResult) => void,
  dragHover: (args: {
    node: TreeItem
    path: number[]
    minimumTreeIndex: number
    depth: number
  }) => void,
  dndType: string
) => {
  const DroppableTarget: React.FC<any> = (props) => {
    const nodeRef = useRef<HTMLElement>(null)

    // React 18: useLayoutEffect ensures props are updated immediately after DOM paint,
    // avoiding stale closures in the 'hover' callback which runs very frequently.
    const propsRef = useRef(props)
    useIsomorphicLayoutEffect(() => {
      propsRef.current = props
    })

    const [{ isOver, canDrop: isCanDrop }, dropConnector] = useDrop(
      () => ({
        accept: dndType,
        drop: (_item, monitor) => {
          const currentProps = propsRef.current
          const item = monitor.getItem() as DragItem
          const result: DropResult = {
            node: item.node,
            path: item.path,
            treeIndex: item.treeIndex,
            treeId,
            minimumTreeIndex: currentProps.treeIndex,
            depth: getTargetDepth(
              currentProps,
              monitor,
              nodeRef,
              canNodeHaveChildren,
              treeId,
              maxDepth
            ),
          }
          drop(result)
          return result
        },
        hover: (item: DragItem, monitor) => {
          const currentProps = propsRef.current
          const targetDepth = getTargetDepth(
            currentProps,
            monitor,
            nodeRef,
            canNodeHaveChildren,
            treeId,
            maxDepth
          )
          const draggedNode = item.node
          const needsRedraw =
            currentProps.node !== draggedNode ||
            targetDepth !== currentProps.path.length - 1

          if (!needsRedraw) {
            return
          }

          dragHover({
            node: draggedNode,
            path: item.path,
            minimumTreeIndex: currentProps.listIndex,
            depth: targetDepth,
          })
        },
        canDrop: (_item, monitor) =>
          canDrop(
            propsRef.current,
            monitor,
            canNodeHaveChildren,
            treeId,
            maxDepth,
            treeRefCanDrop
          ),
        collect: (monitor) => ({
          isOver: monitor.isOver(),
          canDrop: monitor.canDrop(),
        }),
      }),
      [dndType, treeId, maxDepth]
    )

    const combinedRef = useCombinedRefs(dropConnector, nodeRef)

    return (
      <Component
        {...props}
        connectDropTarget={combinedRef}
        isOver={isOver}
        canDrop={isCanDrop}
      />
    )
  }
  return DroppableTarget
}
