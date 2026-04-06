import React, { JSX } from 'react'
import { ConnectDragPreview, ConnectDragSource } from 'react-dnd'
import { classnames } from '../../../utils/classnames'
import { isDescendant } from '../../../utils/tree-data-utils'
import { TreeItem, NodeData } from '../../../types'

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
  title?: (data: NodeData) => JSX.Element
  subtitle?: (data: NodeData) => JSX.Element
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

// SVG Icons
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
  buttons = [],
  className = '',
  style = {},
  parentNode: _parentNode = undefined,
  draggedNode = undefined,
  canDrop = false,
  title = undefined,
  rowDirection = 'ltr',

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
  const isFolder = hasChildren || node.isDirectory

  // Extract file extension from title if it's a string
  const getExtension = () => {
    if (typeof nodeTitle === 'string' && !isFolder) {
      const parts = nodeTitle.split('.')
      if (parts.length > 1) {
        return parts.at(-1)
      }
    }
    return undefined
  }

  const isDraggedDescendant = draggedNode && isDescendant(draggedNode, node)
  const isLandingPadActive = !didDrop && isDragging

  const handleToggle = () => {
    if (toggleChildrenVisibility && hasChildren) {
      toggleChildrenVisibility({ node, path, treeIndex })
    }
  }

  const nodeContent = (
    <div
      className={classnames(
        'rst__fe-row',
        isLandingPadActive ? 'rst__fe-rowLandingPad' : '',
        isLandingPadActive && !canDrop ? 'rst__fe-rowCancelPad' : '',
        isSearchMatch ? 'rst__fe-rowSearchMatch' : '',
        isSearchFocus ? 'rst__fe-rowSearchFocus' : '',
        rowDirectionClass ?? '',
        className ?? ''
      )}
      style={{
        opacity: isDraggedDescendant ? 0.5 : 1,
        ...style,
      }}>
      {/* Expand/Collapse Chevron */}
      <span
        className={classnames(
          'rst__fe-chevron',
          hasChildren ? 'rst__fe-chevronVisible' : ''
        )}
        onClick={handleToggle}>
        {hasChildren &&
          (node.expanded ? <ChevronDownIcon /> : <ChevronRightIcon />)}
      </span>

      {/* File/Folder Icon */}
      <span className="rst__fe-icon">
        {isFolder ? (
          <FolderIcon expanded={node.expanded} />
        ) : (
          <FileIcon extension={getExtension()} />
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
    <div ref={connectDragSource} style={{ height: '100%' }}>
      {connectDragPreview(nodeContent)}
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
