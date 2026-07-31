import React, { Children, JSX, ReactNode, cloneElement } from 'react'
import { ConnectDropTarget } from 'react-dnd'
import { TreeItem } from './types'
import { classnames } from './utils/classnames'
import { type FlatDataItem } from './utils/tree-data-utils'
import './tree-node.css'

export interface TreeRendererProps {
  treeIndex: number
  treeId: string
  swapFrom?: number
  swapDepth?: number
  swapLength?: number
  scaffoldBlockPxWidth: number
  lowerSiblingCounts: number[]
  rowDirection: 'ltr' | 'rtl' | string | undefined
  rowHeight:
    number | ((treeIndex: number, node: TreeItem, path: number[]) => number)

  listIndex: number
  children: JSX.Element[]
  style?: React.CSSProperties

  // Drop target
  connectDropTarget: ConnectDropTarget
  isOver: boolean
  canDrop?: boolean
  draggedNode?: TreeItem

  // used in dndManager
  getPrevRow: () => FlatDataItem | undefined
  node: TreeItem
  path: number[]
}

const getLineClass = (
  lowerSiblingCount: number,
  listIndex: number,
  i: number,
  scaffoldBlockCount: number
): string => {
  if (lowerSiblingCount > 0) {
    if (listIndex === 0)
      // Top-left corner of the tree
      // +-----+
      // |     |
      // |  +--+
      // |  |  |
      // +--+--+
      return 'rst__lineHalfHorizontalRight rst__lineHalfVerticalBottom'
    if (i === scaffoldBlockCount - 1)
      // Last scaffold block in the row, right before the row content
      // +--+--+
      // |  |  |
      // |  +--+
      // |  |  |
      // +--+--+
      return 'rst__lineHalfHorizontalRight rst__lineFullVertical'
    // Simply connecting the line extending down to the next sibling on this level
    // +--+--+
    // |  |  |
    // |  |  |
    // |  |  |
    // +--+--+
    return 'rst__lineFullVertical'
  }
  // Top-left corner of the tree, but has no siblings
  // +-----+
  // |     |
  // |  +--+
  // |     |
  // +-----+
  if (listIndex === 0) return 'rst__lineHalfHorizontalRight'
  if (i === scaffoldBlockCount - 1)
    // The last or only node in this level of the tree
    // +--+--+
    // |  |  |
    // |  +--+
    // |     |
    // +-----+
    return 'rst__lineHalfVerticalTop rst__lineHalfHorizontalRight'
  return ''
}

const TreeNodeComponent: React.FC<TreeRendererProps> = ({
  children,
  listIndex,
  swapFrom = undefined,
  swapLength = undefined,
  swapDepth = undefined,
  scaffoldBlockPxWidth,
  lowerSiblingCounts,
  connectDropTarget,
  isOver,
  draggedNode = undefined,
  canDrop = false,
  treeIndex,
  rowHeight,
  rowDirection = 'ltr',
  // Extract props not used in DOM or needed by children directly
  treeId: _treeId,
  getPrevRow: _getPrevRow,
  node,
  path,
  ...otherProps
}) => {
  const rowDirectionClass = rowDirection === 'rtl' ? 'rst__rtl' : undefined

  // Construct the scaffold representing the structure of the tree
  const scaffoldBlockCount = lowerSiblingCounts.length
  const scaffold: ReactNode[] = []

  for (const [i, lowerSiblingCount] of lowerSiblingCounts.entries()) {
    const lineClass = getLineClass(
      lowerSiblingCount,
      listIndex,
      i,
      scaffoldBlockCount
    )

    scaffold.push(
      <div
        key={`pre_${1 + i}`}
        style={{ width: scaffoldBlockPxWidth }}
        className={classnames(
          'rst__lineBlock',
          lineClass,
          rowDirectionClass ?? ''
        )}
      />
    )

    if (treeIndex !== listIndex && i === swapDepth) {
      // This row has been shifted, and is at the depth of
      // the line pointing to the new destination
      let highlightLineClass: string
      if (listIndex === swapFrom! + swapLength! - 1) {
        // This block is on the bottom (target) line
        // This block points at the target block (where the row will go when released)
        highlightLineClass = 'rst__highlightBottomLeftCorner'
      } else if (treeIndex === swapFrom) {
        // This block is on the top (source) line
        highlightLineClass = 'rst__highlightTopLeftCorner'
      } else {
        // This block is between the bottom and top
        highlightLineClass = 'rst__highlightLineVertical'
      }

      const style =
        rowDirection === 'rtl'
          ? {
              width: scaffoldBlockPxWidth,
              right: scaffoldBlockPxWidth * i,
            }
          : {
              width: scaffoldBlockPxWidth,
              left: scaffoldBlockPxWidth * i,
            }

      scaffold.push(
        <div
          key={i}
          style={style}
          className={classnames(
            'rst__absoluteLineBlock',
            highlightLineClass,
            rowDirectionClass ?? ''
          )}
        />
      )
    }
  }

  const contentStyle =
    rowDirection === 'rtl'
      ? { right: scaffoldBlockPxWidth * scaffoldBlockCount }
      : { left: scaffoldBlockPxWidth * scaffoldBlockCount }

  const calculatedRowHeight =
    typeof rowHeight === 'function'
      ? rowHeight(treeIndex, node, path)
      : rowHeight

  return (
    <div
      {...otherProps}
      ref={connectDropTarget as unknown as React.Ref<HTMLDivElement>}
      style={{ height: `${calculatedRowHeight}px` }}
      className={classnames('rst__node', rowDirectionClass ?? '')}>
      {scaffold}

      <div className="rst__nodeContent" style={contentStyle}>
        {Children.map(children, (child) =>
          cloneElement(child as React.ReactElement<Record<string, unknown>>, {
            isOver,
            canDrop,
            draggedNode,
          })
        )}
      </div>
    </div>
  )
}

/**
 * Deliberately not wrapped in `React.memo`.
 *
 * Each row is rendered as `<TreeNodeRenderer …><NodeContentRenderer …/></…>`,
 * so `children` is a fresh element on every render and a shallow prop
 * comparison can never pass — measured: rows still re-rendered after a parent
 * re-render with the memo in place. It was pure overhead plus a misleading
 * signal that rows were memoized.
 *
 * Making memoization effective needs the row to stop taking its content as
 * `children`. Note that rows are virtualized, so only the visible window
 * ever re-renders.
 */
export default TreeNodeComponent
