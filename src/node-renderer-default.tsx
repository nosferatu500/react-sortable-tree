import React, { type JSX } from 'react'
import type { ConnectDragPreview, ConnectDragSource } from 'react-dnd'
import type { NodeData, TreeItem, TreeItemContent } from './types'
import { classnames } from './utils/classnames'
import { isDescendant } from './utils/tree-data-utils'
import './node-renderer-default.css'

export interface NodeRendererProps {
  node: TreeItem
  path: number[]
  treeIndex: number
  isSearchMatch: boolean
  isSearchFocus: boolean
  canDrag: boolean
  scaffoldBlockPxWidth: number
  toggleChildrenVisibility?(data: NodeData): void | undefined
  buttons?: JSX.Element[]
  className?: string
  style?: React.CSSProperties
  /** Overrides `node.title`; same value-or-function shape. */
  title?: TreeItemContent
  subtitle?: TreeItemContent
  icons?: JSX.Element[]
  lowerSiblingCounts: number[]
  swapDepth?: number
  swapFrom?: number
  swapLength?: number
  listIndex: number
  treeId: string
  rowDirection: 'ltr' | 'rtl' | string | undefined

  connectDragPreview: ConnectDragPreview
  connectDragSource: ConnectDragSource
  parentNode?: TreeItem
  startDrag: ({ path }: { path: number[] }) => void
  endDrag: (dropResult: unknown) => void
  isDragging: boolean
  didDrop: boolean
  draggedNode?: TreeItem
  isOver: boolean
  canDrop?: boolean
}

const NO_BUTTONS: React.ReactNode[] = []
const NO_STYLE: React.CSSProperties = {}

const renderToggleSection = (
  node: TreeItem,
  isDragging: boolean,
  scaffoldBlockPxWidth: number,
  rowDirectionClass: string | undefined,
  toggleChildrenVisibility: ((data: NodeData) => void) | undefined,
  path: number[],
  treeIndex: number,
  buttonStyle: React.CSSProperties
): React.ReactNode => {
  if (
    !toggleChildrenVisibility ||
    !node.children ||
    (node.children.length === 0 && typeof node.children !== 'function')
  ) {
    return null
  }
  return (
    <div>
      <button
        type="button"
        aria-label={node.expanded ? 'Collapse' : 'Expand'}
        className={classnames(
          node.expanded ? 'rst__collapseButton' : 'rst__expandButton',
          rowDirectionClass ?? ''
        )}
        style={buttonStyle}
        onClick={() => toggleChildrenVisibility({ node, path, treeIndex })}
      />
      {node.expanded && !isDragging && (
        <div
          style={{ width: scaffoldBlockPxWidth }}
          className={classnames('rst__lineChildren', rowDirectionClass ?? '')}
        />
      )}
    </div>
  )
}

const renderHandle = (
  node: TreeItem,
  rowDirectionClass: string | undefined,
  connectDragSource: ConnectDragSource
): React.ReactNode => {
  if (typeof node.children === 'function' && node.expanded) {
    return (
      <div className="rst__loadingHandle">
        <div className="rst__loadingCircle">
          {Array.from({ length: 12 }, (_, index) => (
            <div
              // oxlint-disable-next-line react/no-array-index-key
              key={index}
              className={classnames(
                'rst__loadingCirclePoint',
                rowDirectionClass ?? ''
              )}
            />
          ))}
        </div>
      </div>
    )
  }
  return (
    <div
      ref={connectDragSource as unknown as React.Ref<HTMLDivElement>}
      className="rst__moveHandle"
    />
  )
}

const NodeRendererDefault: React.FC<NodeRendererProps> = ({
  isSearchMatch = false,
  isSearchFocus = false,
  canDrag = false,
  toggleChildrenVisibility = undefined,
  buttons = NO_BUTTONS,
  className = '',
  style = NO_STYLE,
  parentNode: _parentNode = undefined,
  draggedNode = undefined,
  canDrop = false,
  title = undefined,
  subtitle = undefined,
  rowDirection = 'ltr',

  scaffoldBlockPxWidth,
  connectDragPreview,
  connectDragSource,
  isDragging,
  node,
  path,
  treeIndex,
  didDrop,
  treeId: _treeId,
  isOver: _isOver,
  ...otherProps
}) => {
  const nodeTitle = title || node.title
  const nodeSubtitle = subtitle || node.subtitle
  const rowDirectionClass = rowDirection === 'rtl' ? 'rst__rtl' : undefined

  const handle = canDrag
    ? renderHandle(node, rowDirectionClass, connectDragSource)
    : undefined

  const isDraggedDescendant = draggedNode && isDescendant(draggedNode, node)
  const isLandingPadActive = !didDrop && isDragging

  const buttonStyle =
    rowDirection === 'rtl'
      ? { right: -0.5 * scaffoldBlockPxWidth, left: 0 }
      : { left: -0.5 * scaffoldBlockPxWidth, right: 0 }

  return (
    <div style={{ height: '100%' }} {...otherProps}>
      {renderToggleSection(
        node,
        isDragging,
        scaffoldBlockPxWidth,
        rowDirectionClass,
        toggleChildrenVisibility,
        path,
        treeIndex,
        buttonStyle
      )}

      <div className={classnames('rst__rowWrapper', rowDirectionClass ?? '')}>
        <div
          ref={connectDragPreview as unknown as React.Ref<HTMLDivElement>}
          className={classnames(
            'rst__row',
            isLandingPadActive ? 'rst__rowLandingPad' : '',
            isLandingPadActive && !canDrop ? 'rst__rowCancelPad' : '',
            isSearchMatch ? 'rst__rowSearchMatch' : '',
            isSearchFocus ? 'rst__rowSearchFocus' : '',
            rowDirectionClass ?? '',
            className ?? ''
          )}
          style={{
            opacity: isDraggedDescendant ? 0.5 : 1,
            ...style,
          }}>
          {handle}

          <div
            className={classnames(
              'rst__rowContents',
              canDrag ? '' : 'rst__rowContentsDragDisabled',
              rowDirectionClass ?? ''
            )}>
            <div
              className={classnames('rst__rowLabel', rowDirectionClass ?? '')}>
              <span
                className={classnames(
                  'rst__rowTitle',
                  node.subtitle ? 'rst__rowTitleWithSubtitle' : ''
                )}>
                {typeof nodeTitle === 'function'
                  ? nodeTitle({
                      node,
                      path,
                      treeIndex,
                    })
                  : nodeTitle}
              </span>

              {nodeSubtitle && (
                <span className="rst__rowSubtitle">
                  {typeof nodeSubtitle === 'function'
                    ? nodeSubtitle({
                        node,
                        path,
                        treeIndex,
                      })
                    : nodeSubtitle}
                </span>
              )}
            </div>

            <div className="rst__rowToolbar">
              {buttons?.map((btn, index) => (
                // oxlint-disable-next-line react/no-array-index-key
                <div key={index} className="rst__toolbarButton">
                  {btn}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NodeRendererDefault
