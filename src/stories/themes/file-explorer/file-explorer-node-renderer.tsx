import type {
  ConnectDragPreview,
  ConnectDragSource,
} from '@nosferatu500/react-dnd'
import React, { type JSX } from 'react'
import type { NodeData, TreeItem, TreeItemContent } from '../../../types'
import { classnames } from '../../../utils/classnames'
import { isDescendant } from '../../../utils/tree-data-utils'

export interface FileExplorerNodeRendererProps {
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
  /**
   * Whether this row holds the tree's single tab stop. Custom renderers should
   * put it on whatever they connect as the drag source, so keyboard drag and
   * drop does not add a tab stop for every visible row.
   */
  isActiveRow?: boolean
  parentNode?: TreeItem
  startDrag: ({ path }: { path: number[] }) => void
  endDrag: (dropResult: unknown) => void
  isDragging: boolean
  didDrop: boolean
  draggedNode?: TreeItem
  isOver: boolean
  canDrop?: boolean
}

// SVG Icons
// Hoisted so the defaults are referentially stable across renders.
const NO_BUTTONS: React.ReactNode[] = []
const NO_STYLE: React.CSSProperties = {}

// Extract a file extension from the title, when the node is a file and the
// title is a plain string.
// `nodeTitle` may also be a render function, so this takes `unknown` and only
// acts on the plain-string case.
const getFileExtension = (
  nodeTitle: unknown,
  isFolder: boolean
): string | undefined => {
  if (isFolder || typeof nodeTitle !== 'string') {
    return undefined
  }

  const parts = nodeTitle.split('.')
  return parts.length > 1 ? parts.at(-1) : undefined
}

/**
 * Names the drag source for announcements. Only a plain-string title can be
 * used; a `ReactNode` or a render function falls back to a generic name.
 */
const dragLabel = (nodeTitle: unknown): string =>
  typeof nodeTitle === 'string' ? `Drag ${nodeTitle}` : 'Drag item'

/** One tab stop per tree, on whichever row currently holds it. */
const rovingTabIndex = (isActiveRow: boolean): number => (isActiveRow ? 0 : -1)

const getRowClassName = ({
  isLandingPadActive,
  canDrop,
  isSearchMatch,
  isSearchFocus,
  rowDirectionClass,
  className,
}: {
  isLandingPadActive: boolean
  canDrop: boolean
  isSearchMatch: boolean
  isSearchFocus: boolean
  rowDirectionClass: string | undefined
  className: string | undefined
}) =>
  classnames(
    'rst__fe-row',
    isLandingPadActive ? 'rst__fe-rowLandingPad' : '',
    isLandingPadActive && !canDrop ? 'rst__fe-rowCancelPad' : '',
    isSearchMatch ? 'rst__fe-rowSearchMatch' : '',
    isSearchFocus ? 'rst__fe-rowSearchFocus' : '',
    rowDirectionClass ?? '',
    className ?? ''
  )

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path
      d="M6 4l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path
      d="M4 6l4 4 4-4"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
  </svg>
)

const FolderIcon = ({ expanded }: { expanded?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    {expanded ? (
      // Open folder
      <path
        d="M1.5 3.5h5l1 1.5h7v8h-13v-9.5z"
        fill="#dcb67a"
        stroke="#c9a655"
        strokeWidth="0.5"
      />
    ) : (
      // Closed folder
      <path
        d="M1.5 3h5l1 1.5h6.5v9h-12.5v-10.5z"
        fill="#dcb67a"
        stroke="#c9a655"
        strokeWidth="0.5"
      />
    )}
  </svg>
)

const FileIcon = ({ extension }: { extension?: string }) => {
  // Color based on file extension
  const getColor = () => {
    switch (extension?.toLowerCase()) {
      case 'ts':
      case 'tsx': {
        return '#3178c6'
      }
      case 'js':
      case 'jsx': {
        return '#f7df1e'
      }
      case 'css':
      case 'scss': {
        return '#264de4'
      }
      case 'html': {
        return '#e34c26'
      }
      case 'json': {
        return '#cbcb41'
      }
      case 'md': {
        return '#083fa1'
      }
      case 'py': {
        return '#3776ab'
      }
      case 'go': {
        return '#00add8'
      }
      case 'rs': {
        return '#dea584'
      }
      default: {
        return '#8a8a8a'
      }
    }
  }

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 1.5h6.5l3.5 3.5v10h-10v-13.5z"
        fill="#fff"
        stroke="#ccc"
        strokeWidth="0.5"
      />
      <path
        d="M9.5 1.5v3.5h3.5"
        stroke="#ccc"
        strokeWidth="0.5"
        fill="#f5f5f5"
      />
      {extension && (
        <text
          x="7"
          y="12"
          fontSize="4"
          fill={getColor()}
          textAnchor="middle"
          fontWeight="bold"
          fontFamily="monospace">
          {extension.slice(0, 3).toUpperCase()}
        </text>
      )}
    </svg>
  )
}

const FileExplorerNodeRenderer: React.FC<FileExplorerNodeRendererProps> = ({
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
  rowDirection = 'ltr',
  isActiveRow = false,

  scaffoldBlockPxWidth: _scaffoldBlockPxWidth,
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
  const rowDirectionClass = rowDirection === 'rtl' ? 'rst__rtl' : undefined
  const hasChildren =
    node.children &&
    (node.children.length > 0 || typeof node.children === 'function')
  const isFolder = Boolean(hasChildren || node.isDirectory)

  const isDraggedDescendant = draggedNode && isDescendant(draggedNode, node)
  const isLandingPadActive = !didDrop && isDragging

  const handleToggle = () => {
    if (toggleChildrenVisibility && hasChildren) {
      toggleChildrenVisibility({ node, path, treeIndex })
    }
  }

  const nodeContent = (
    <div
      className={getRowClassName({
        isLandingPadActive,
        canDrop,
        isSearchMatch,
        isSearchFocus,
        rowDirectionClass,
        className,
      })}
      style={{
        opacity: isDraggedDescendant ? 0.5 : 1,
        ...style,
      }}>
      {/* Expand/Collapse Chevron */}
      <button
        type="button"
        className={classnames(
          'rst__fe-chevron',
          hasChildren ? 'rst__fe-chevronVisible' : ''
        )}
        // Hidden from assistive tech when there is nothing to expand, so the
        // toolbar isn't littered with unusable controls.
        aria-hidden={!hasChildren}
        tabIndex={hasChildren ? 0 : -1}
        aria-expanded={hasChildren ? node.expanded === true : undefined}
        aria-label={hasChildren ? 'Toggle children' : undefined}
        onClick={handleToggle}>
        {hasChildren &&
          (node.expanded ? <ChevronDownIcon /> : <ChevronRightIcon />)}
      </button>

      {/* File/Folder Icon */}
      <span className="rst__fe-icon">
        {isFolder ? (
          <FolderIcon expanded={node.expanded} />
        ) : (
          <FileIcon extension={getFileExtension(nodeTitle, isFolder)} />
        )}
      </span>

      {/* Node Title */}
      <span className="rst__fe-title">
        {typeof nodeTitle === 'function'
          ? nodeTitle({ node, path, treeIndex })
          : nodeTitle}
      </span>

      {/* Action Buttons */}
      {buttons && buttons.length > 0 && (
        <span className="rst__fe-toolbar">
          {buttons.map((btn, index) => (
            // Caller-supplied nodes with no stable identity available, so the
            // index is the only usable key.
            // oxlint-disable-next-line react/no-array-index-key
            <span key={index} className="rst__fe-toolbarButton">
              {btn}
            </span>
          ))}
        </span>
      )}
    </div>
  )

  // Wrap with drag source if draggable
  const draggableContent = canDrag ? (
    // Source and preview share one element. Connectors are ordinary ref
    // callbacks now, so they attach directly — but two of them need a
    // block-bodied callback rather than `ref={(n) => a(b(n))}`, which would
    // hand React the connector's return value.
    <div
      ref={(element) => {
        connectDragSource(element)
        connectDragPreview(element)
      }}
      // This theme drags by the whole row rather than a separate handle, so the
      // row itself is the drag source and carries the tab stop. Without an
      // explicit `tabIndex` the keyboard backend would make every visible row
      // focusable and the tree would stop being a single tab stop.
      //
      // The element really is interactive — it can be picked up and moved by
      // keyboard — but it cannot be a `<button>`, because it wraps the chevron
      // and the toolbar buttons and interactive elements may not nest. The
      // backend notices those descendants and gives it `role="group"` rather
      // than `role="button"`, plus `aria-roledescription="draggable item"`.
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={rovingTabIndex(isActiveRow)}
      aria-label={dragLabel(nodeTitle)}
      style={{ height: '100%' }}>
      {nodeContent}
    </div>
  ) : (
    nodeContent
  )

  return (
    <div style={{ height: '100%' }} {...otherProps}>
      {draggableContent}
    </div>
  )
}

export default FileExplorerNodeRenderer
