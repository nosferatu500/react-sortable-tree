import React, { Children, JSX, ReactNode, cloneElement } from 'react'
import { ConnectDropTarget } from 'react-dnd'
import { TreeItem, TreeNode, TreePath } from './types'
import { classnames } from './utils/classnames'
import './tree-node.css'

export interface FlatDataItem extends TreeNode, TreePath {
  lowerSiblingCounts: number[]
  parentNode: TreeItem
}

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
    | number
    | ((treeIndex: number, node: TreeItem, path: number[]) => number)

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
    let lineClass = ''
    if (lowerSiblingCount > 0) {
      // At this level in the tree, the nodes had sibling nodes further down
      if (listIndex === 0) {
        // Top-left corner of the tree
        // +-----+
        // |     |
        // |  +--+
        // |  |  |
        // +--+--+
        lineClass = 'rst__lineHalfHorizontalRight rst__lineHalfVerticalBottom'
      } else if (i === scaffoldBlockCount - 1) {
        // Last scaffold block in the row, right before the row content
        // +--+--+
        // |  |  |
        // |  +--+
        // |  |  |
        // +--+--+
        lineClass = 'rst__lineHalfHorizontalRight rst__lineFullVertical'
      } else {
        // Simply connecting the line extending down to the next sibling on this level
        // +--+--+
        // |  |  |
        // |  |  |
        // |  |  |
        // +--+--+
        lineClass = 'rst__lineFullVertical'
      }
    } else if (listIndex === 0) {
      // Top-left corner of the tree, but has no siblings
      // +-----+
      // |     |
      // |  +--+
      // |     |
      // +-----+
      lineClass = 'rst__lineHalfHorizontalRight'
    } else if (i === scaffoldBlockCount - 1) {
      // The last or only node in this level of the tree
      // +--+--+
      // |  |  |
      // |  +--+
      // |     |
      // +-----+
      lineClass = 'rst__lineHalfVerticalTop rst__lineHalfHorizontalRight'
    }

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
      let highlightLineClass = ''

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

  let calculatedRowHeight = rowHeight
  if (typeof rowHeight === 'function') {
    calculatedRowHeight = rowHeight(treeIndex, node, path)
  }

  return (
    <div
      {...otherProps}
      ref={connectDropTarget as unknown as React.Ref<HTMLDivElement>}
      style={{ height: `${calculatedRowHeight}px` }}
      className={classnames('rst__node', rowDirectionClass ?? '')}>
      {scaffold}

      <div className="rst__nodeContent" style={contentStyle}>
        {Children.map(children, (child: any) =>
          cloneElement(child, {
            isOver,
            canDrop,
            draggedNode,
          })
        )}
      </div>
    </div>
  )
}

export default React.memo(TreeNodeComponent)
