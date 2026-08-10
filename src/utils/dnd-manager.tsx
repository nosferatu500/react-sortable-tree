import {
  type DropTargetMonitor,
  useDrag,
  useDrop,
} from '@nosferatu500/react-dnd'
import React, { type Ref, useCallback, useRef } from 'react'
import type { TreeRendererProps } from '../tree-node'
import type { TreeItem } from '../types'
import type { KeyboardDragController } from './keyboard-drag'
import { getDepth } from './tree-data-utils'
import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect'

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
 * Everything the wrapped components need from the tree, read at event time.
 *
 * These arrive behind a stable getter rather than as direct arguments so that
 * `wrapSource`, `wrapTarget` and `wrapPlaceholder` can be memoized on nothing
 * but the renderer, the tree id and the dnd type. Passing the callbacks
 * directly would mint a new component *type* whenever any of them changed
 * identity — and React reconciles by type, so every row, and every registered
 * drop target with it, would be unmounted and remounted on each parent render.
 */
export interface TreeDndHandlers {
  canNodeHaveChildren: (node: TreeItem) => boolean
  canDrop?: (args: CanDropArgs) => boolean
  maxDepth?: number
  /** Supplies the horizontal intent a keyboard drag has no pointer for. */
  keyboard: KeyboardDragController
  startDrag: (item: { path: number[] }) => void
  endDrag: (dropResult: DropResult | null) => void
  drop: (dropResult: DropResult) => void
  dragHover: (args: {
    node: TreeItem
    path: number[]
    minimumTreeIndex: number
    depth: number
  }) => void
}

export type GetTreeDndHandlers = () => TreeDndHandlers

/*
 * ---------------------------------------------------------------------------
 * Why all three wrapped components carry `'use no memo'`
 * ---------------------------------------------------------------------------
 *
 * The React Compiler *outlines* callbacks it believes are constant, moving them
 * to module scope as `_temp1`, `_temp2`, … Its capture analysis misses variables
 * belonging to an enclosing factory: each component here is created by
 * `wrapSource` / `wrapPlaceholder` / `wrapTarget` and closes over their
 * parameters (`dndType`, `treeId`, `getHandlers`), which are neither module
 * scope nor component scope.
 *
 * Compiled, the placeholder's `useDrop` spec came out as:
 *
 *   function _temp5() { return { accept: dndType, … } }   // dndType unbound
 *
 * so rendering an *empty* tree threw `ReferenceError: dndType is not defined`,
 * and the drag-end and placeholder-drop callbacks were broken the same way.
 * This shipped in 6.0.0 and was reported by a consumer.
 *
 * It could not be caught here: the suite runs against `src/`, so nothing
 * exercised compiler output. `npm run test:build` now renders the built bundle,
 * including the empty-tree path.
 *
 * These are thin wrappers around `useDrag`/`useDrop` — the memoization that
 * matters is in the row renderers and `tree-data-utils`, both still compiled.
 * Remove the directives only against a passing `test:build`.
 */

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
          // eslint-disable-next-line react-hooks/immutability
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
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
    refs
  )
}

export const wrapSource = (
  Component: AnyComponent,
  dndType: string,
  getHandlers: GetTreeDndHandlers
): AnyComponent => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DraggableSource: React.FC<any> = (props) => {
    'use no memo'
    // Keeps the drag callbacks free of per-render props without re-running
    // useDrag: a layout effect lands before any pointer event can fire.
    const propsRef = useRef(props)
    useIsomorphicLayoutEffect(() => {
      propsRef.current = props
    })

    const [{ isDragging }, drag, preview] = useDrag(
      () => ({
        type: dndType,
        item: () => {
          const currentProps = propsRef.current
          getHandlers().startDrag(currentProps)
          return {
            node: currentProps.node,
            parentNode: currentProps.parentNode,
            path: currentProps.path,
            treeIndex: currentProps.treeIndex,
            treeId: currentProps.treeId,
          }
        },
        end: (_item, monitor) => {
          getHandlers().endDrag(monitor.getDropResult() as DropResult)
        },
        collect: (monitor) => ({
          isDragging: monitor.isDragging(),
        }),
      }),
      [dndType, getHandlers]
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
  dndType: string,
  getHandlers: GetTreeDndHandlers
): AnyComponent => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DroppablePlaceholder: React.FC<any> = (props) => {
    'use no memo'
    const [{ isOver, canDrop }, dropRef] = useDrop(
      () => ({
        accept: dndType,
        drop: (item: DragItem) => {
          const { node, path, treeIndex } = item
          const result: DropResult = {
            node,
            path,
            treeIndex,
            treeId,
            minimumTreeIndex: 0,
            depth: 0,
          }
          getHandlers().drop(result)
          return result
        },
        collect: (monitor) => ({
          isOver: monitor.isOver(),
          canDrop: monitor.canDrop(),
        }),
      }),
      [dndType, treeId, getHandlers]
    )

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

/*
 * `item` is threaded through rather than read back off the monitor.
 * `monitor.getItem()` is typed `T | null` — it really is null before a drag
 * opens — while the `item` argument these callbacks receive is non-null for the
 * whole of `drop` / `hover` / `canDrop`. Passing it explicitly is what the
 * fork's migration notes recommend, and it removes the null checks entirely.
 */
const getBlocksOffset = (
  dropTargetProps: DropTargetProps,
  item: DragItem,
  monitor: DropTargetMonitor<DragItem, DropResult>,
  treeId: string,
  componentRef: React.RefObject<HTMLElement | null>,
  keyboard: KeyboardDragController
): { blocksOffset: number; dragSourceInitialDepth: number } => {
  const dragSourceInitialDepth = (item.path || []).length

  // A keyboard drag reports a client offset too — the centre of the hovered row
  // — so the pointer maths below would read the width of a row as several
  // blocks of nesting. Its horizontal intent comes from the arrow keys instead.
  if (keyboard.isDragging()) {
    return { blocksOffset: keyboard.blocksOffset(), dragSourceInitialDepth }
  }

  if (item.treeId === treeId) {
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
  item: DragItem,
  monitor: DropTargetMonitor<DragItem, DropResult>,
  componentRef: React.RefObject<HTMLElement | null>,
  canNodeHaveChildren: (node: TreeItem) => boolean,
  treeId: string,
  keyboard: KeyboardDragController,
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
    item,
    monitor,
    treeId,
    componentRef,
    keyboard
  )

  let targetDepth = Math.min(
    dropTargetDepth,
    Math.max(0, dragSourceInitialDepth + blocksOffset - 1)
  )

  if (maxDepth !== undefined) {
    const draggedChildDepth = getDepth(item.node)
    targetDepth = Math.max(
      0,
      Math.min(targetDepth, maxDepth - draggedChildDepth - 1)
    )
  }

  return targetDepth
}

const canDrop = (
  dropTargetProps: DropTargetProps,
  item: DragItem,
  monitor: DropTargetMonitor<DragItem, DropResult>,
  treeRefCanDrop: ((args: CanDropArgs) => boolean) | undefined,
  keyboard: KeyboardDragController
) => {
  // Under a pointer, only the row beneath the cursor is a candidate, and this
  // keeps `canDrop` in collected props meaning "here". A keyboard drag has no
  // cursor: the backend asks every target whether it accepts the item *before*
  // hovering anything, to decide where to hover first. Answering "not over, so
  // no" to all of them reports the tree as having no drop targets at all and
  // unwinds the drag immediately.
  if (!keyboard.isDragging() && !monitor.isOver()) {
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
    return treeRefCanDrop({
      node: item.node,
      prevPath: item.path,
      prevParent: item.parentNode,
      prevTreeIndex: item.treeIndex,
      nextPath: dropTargetProps.path,
      nextParent: dropTargetProps.parentNode,
      nextTreeIndex: dropTargetProps.treeIndex,
    })
  }
  return true
}

/** Everything one row's hover needs, gathered so the work can live at module scope. */
interface HoverContext {
  propsRef: React.RefObject<DropTargetProps & { listIndex: number }>
  item: DragItem
  monitor: DropTargetMonitor<DragItem, DropResult>
  nodeRef: React.RefObject<HTMLElement | null>
  treeId: string
  getHandlers: GetTreeDndHandlers
}

/**
 * Tells the tree where the dragged node would land right now.
 *
 * `force` skips the redraw guard, which exists to drop the stream of identical
 * `dragover` events a pointer produces. An arrow key changing the depth replays
 * the same hover on the same row, which the guard would dismiss as a no-op —
 * `dragHover` still ignores genuine repeats of the same depth and position.
 */
const performHover = (context: HoverContext, force: boolean): void => {
  const { propsRef, item, monitor, nodeRef, treeId, getHandlers } = context
  const currentProps = propsRef.current
  const { canNodeHaveChildren, maxDepth, keyboard, dragHover } = getHandlers()
  const targetDepth = getTargetDepth(
    currentProps,
    item,
    monitor,
    nodeRef,
    canNodeHaveChildren,
    treeId,
    keyboard,
    maxDepth
  )
  const draggedNode = item.node
  const needsRedraw =
    currentProps.node !== draggedNode ||
    targetDepth !== currentProps.path.length - 1

  if (!force && !needsRedraw) {
    return
  }

  if (keyboard.isDragging()) {
    // The requested depth may have been clamped by the rows around this one.
    keyboard.syncToDepth(targetDepth, (item.path || []).length)
  }

  dragHover({
    node: draggedNode,
    path: item.path,
    minimumTreeIndex: currentProps.listIndex,
    depth: targetDepth,
  })
}

/** The closure an arrow key calls to re-run this row's hover at a new depth. */
const replayHover = (context: HoverContext) => (): void =>
  performHover(context, true)

export const wrapTarget = (
  Component: AnyComponent,
  treeId: string,
  dndType: string,
  getHandlers: GetTreeDndHandlers
): AnyComponent => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DroppableTarget: React.FC<any> = (props) => {
    'use no memo'
    const nodeRef = useRef<HTMLElement>(null)

    // The hover handler runs on every mousemove, so it must never close over
    // stale row props. A layout effect refreshes them before any pointer event.
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
        drop: (item, monitor) => {
          const currentProps = propsRef.current
          const { canNodeHaveChildren, maxDepth, keyboard, drop } =
            getHandlers()
          const result: DropResult = {
            node: item.node,
            path: item.path,
            treeIndex: item.treeIndex,
            treeId,
            minimumTreeIndex: currentProps.treeIndex,
            depth: getTargetDepth(
              currentProps,
              item,
              monitor,
              nodeRef,
              canNodeHaveChildren,
              treeId,
              keyboard,
              maxDepth
            ),
          }
          drop(result)
          return result
        },
        hover: (item, monitor) => {
          const context: HoverContext = {
            propsRef,
            item,
            monitor,
            nodeRef,
            treeId,
            getHandlers,
          }
          // Whichever row is hovered owns the replay, so a depth change always
          // re-runs against the row the item would actually land next to.
          getHandlers().keyboard.setReplayHover(replayHover(context))
          performHover(context, false)
        },
        canDrop: (item, monitor) => {
          const { canDrop: treeCanDrop, keyboard } = getHandlers()
          return canDrop(propsRef.current, item, monitor, treeCanDrop, keyboard)
        },
        collect: (monitor) => ({
          isOver: monitor.isOver(),
          canDrop: monitor.canDrop(),
        }),
      }),
      [dndType, treeId, getHandlers]
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
