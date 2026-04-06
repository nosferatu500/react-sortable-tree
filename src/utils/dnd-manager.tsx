import React, { Ref, useCallback, useLayoutEffect, useRef } from 'react'
import { DropTargetMonitor, useDrag, useDrop } from 'react-dnd'
import { type TreeRendererProps } from '../tree-node'
import { TreeItem } from '../types'
import { getDepth } from './tree-data-utils'

type DropTargetProps = Pick<
  TreeRendererProps,
  | 'getPrevRow'
  | 'path'
  | 'rowDirection'
  | 'scaffoldBlockPxWidth'
  | 'treeIndex'
  | 'listIndex'
  | 'node'
> & { parentNode?: TreeItem }

type CanDropArgs = {
  node: TreeItem
  prevPath: number[]
  prevParent: TreeItem | undefined
  prevTreeIndex: number
  nextPath: number[]
  nextParent: TreeItem | undefined
  nextTreeIndex: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>

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
          ref.current = handle
        }
      }
      // React 19: Return cleanup function (ignored in React 18)
      return () => {
        for (const ref of refs) {
          if (!ref) continue
          if (typeof ref === 'function') {
            ref(null)
          } else {
            ref.current = null
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refs // Pass the array directly to avoid regeneration on every render
  )
}

export const wrapSource = (
  Component: AnyComponent,
  startDrag: (props: DragItem) => void,
  endDrag: (dropResult: DropResult | null) => void,
  dndType: string
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        connectDragSource={drag}
        connectDragPreview={preview}
        isDragging={isDragging}
        didDrop={false}
      />
    )
  }
  return DraggableSource
}

export const wrapPlaceholder = (
  Component: AnyComponent,
  treeId: string,
  drop: (dropResult: DropResult) => void,
  dndType: string
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        connectDropTarget={dropRef}
        isOver={isOver}
        canDrop={canDrop}
      />
    )
  }
  return DroppablePlaceholder
}

const getBlocksOffset = (
  dropTargetProps: DropTargetProps,
  monitor: DropTargetMonitor,
  treeId: string,
  componentRef: React.RefObject<HTMLElement | null>
): { blocksOffset: number; dragSourceInitialDepth: number } => {
  const dragSourceInitialDepth = (monitor.getItem().path || []).length

  if (monitor.getItem().treeId === treeId) {
    const direction = dropTargetProps.rowDirection === 'rtl' ? -1 : 1
    const diff = monitor.getDifferenceFromInitialOffset()
    const x = diff ? diff.x : 0
    return {
      blocksOffset: Math.round(
        (direction * x) / dropTargetProps.scaffoldBlockPxWidth
      ),
      dragSourceInitialDepth,
    }
  }

  if (componentRef.current) {
    const relativePosition = componentRef.current.getBoundingClientRect()
    const clientOffset = monitor.getSourceClientOffset()
    const leftShift = clientOffset ? clientOffset.x - relativePosition.left : 0
    return {
      blocksOffset: Math.round(
        leftShift / dropTargetProps.scaffoldBlockPxWidth
      ),
      dragSourceInitialDepth: 0,
    }
  }

  return {
    blocksOffset: dropTargetProps.path.length,
    dragSourceInitialDepth: 0,
  }
}

const getTargetDepth = (
  dropTargetProps: DropTargetProps,
  monitor: DropTargetMonitor,
  componentRef: React.RefObject<HTMLElement | null>,
  canNodeHaveChildren: (node: TreeItem) => boolean,
  treeId: string,
  maxDepth?: number
) => {
  let dropTargetDepth = 0

  const rowAbove = dropTargetProps.getPrevRow()
  if (rowAbove) {
    const { node } = rowAbove
    let { path } = rowAbove
    if (!canNodeHaveChildren(node)) {
      path = path.toSpliced(-1)
    }
    dropTargetDepth = Math.min(path.length, dropTargetProps.path.length)
  }

  const { blocksOffset, dragSourceInitialDepth } = getBlocksOffset(
    dropTargetProps,
    monitor,
    treeId,
    componentRef
  )

  let targetDepth = Math.min(
    dropTargetDepth,
    Math.max(0, dragSourceInitialDepth + blocksOffset - 1)
  )

  if (maxDepth !== undefined) {
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
  dropTargetProps: DropTargetProps,
  monitor: DropTargetMonitor,
  canNodeHaveChildren: (node: TreeItem) => boolean,
  treeId: string,
  maxDepth: number | undefined,
  treeRefCanDrop: ((args: CanDropArgs) => boolean) | undefined
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
    const { node } = monitor.getItem()
    return treeRefCanDrop({
      node,
      prevPath: monitor.getItem().path,
      prevParent: monitor.getItem().parentNode,
      prevTreeIndex: monitor.getItem().treeIndex,
      nextPath: dropTargetProps.path,
      nextParent: dropTargetProps.parentNode,
      nextTreeIndex: dropTargetProps.treeIndex,
    })
  }
  return true
}

export const wrapTarget = (
  Component: AnyComponent,
  canNodeHaveChildren: (node: TreeItem) => boolean,
  treeId: string,
  maxDepth: number | undefined,
  treeRefCanDrop: ((args: CanDropArgs) => boolean) | undefined,
  drop: (dropResult: DropResult) => void,
  dragHover: (args: {
    node: TreeItem
    path: number[]
    minimumTreeIndex: number
    depth: number
  }) => void,
  dndType: string
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DroppableTarget: React.FC<any> = (props) => {
    const nodeRef = useRef<HTMLElement>(null)

    // React 18: useLayoutEffect ensures props are updated immediately after DOM paint,
    // avoiding stale closures in the 'hover' callback which runs very frequently.
    const propsRef = useRef(props)
    useIsomorphicLayoutEffect(() => {
      propsRef.current = props
    })

    const [{ isOver, canDrop: isCanDrop }, dropConnector] = useDrop<
      DragItem,
      DropResult,
      { isOver: boolean; canDrop: boolean }
    >(
      () => ({
        accept: dndType,
        drop: (_item, monitor) => {
          const currentProps = propsRef.current
          const item = monitor.getItem()
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
        hover: (item, monitor) => {
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

    const combinedRef = useCombinedRefs(
      dropConnector as unknown as Ref<HTMLElement>,
      nodeRef
    )

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
