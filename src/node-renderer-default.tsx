import type {
  ConnectDragPreview,
  ConnectDragSource,
} from '@nosferatu500/react-dnd'
import React, { type JSX } from 'react'
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
  /**
   * Whether this row currently holds the tree's single tab stop. The drag handle
   * follows it, so that keyboard drag-and-drop does not add one tab stop per
   * visible row.
   */
  isActiveRow?: boolean
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

/**
 * A name for the drag handle, and therefore for what a screen reader says when
 * the row is picked up: the keyboard backend describes a source by its
 * `aria-label`, falling back to its text content — and the handle has none.
 *
 * Only a plain-string title can be used. A `ReactNode` or a render function may
 * be anything at all, and rendering one to text here is neither possible nor
 * cheap, so those fall back to a generic name.
 */
const dragHandleLabel = (node: TreeItem): string =>
  typeof node.title === 'string' ? `Drag ${node.title}` : 'Drag item'

const renderHandle = (
  node: TreeItem,
  rowDirectionClass: string | undefined,
  connectDragSource: ConnectDragSource,
  isActiveRow: boolean
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
    /*
     * Deliberately a `div` with `role="button"` rather than a real `<button>`,
     * even though the expand/collapse control above is one.
     *
     * The HTML5 backend drags a source by setting `draggable="true"` on it, and
     * browsers have long-standing bugs dragging form controls — Firefox
     * especially. The handle's whole job is to be dragged by a pointer, and the
     * test suite is jsdom-only so it could not catch that regression. The role
     * buys the same semantics at no risk; it is also exactly what the keyboard
     * backend would write here itself.
     */
    <div
      ref={connectDragSource}
      className="rst__moveHandle"
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="button"
      // The backend makes every connected source focusable, which would be one
      // tab stop per visible row. It defers to a `tabindex` that is already
      // there, so the handle joins the tree's single roving tab stop instead.
      tabIndex={isActiveRow ? 0 : -1}
      // The backend names a source from its `aria-label`, falling back to text
      // content — and the handle has none, so announcements would say "Picked
      // up .".
      aria-label={dragHandleLabel(node)}
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
  isActiveRow = false,

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
    ? renderHandle(node, rowDirectionClass, connectDragSource, isActiveRow)
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
          ref={connectDragPreview}
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
