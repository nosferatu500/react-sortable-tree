import FileExplorerNodeRenderer from './file-explorer-node-renderer'
import './file-explorer-theme.css'

/**
 * File Explorer Theme for react-sortable-tree
 *
 * A compact, VS Code-like file explorer theme with:
 * - Chevron arrows for expand/collapse
 * - File/folder icons with extension-based coloring
 * - Compact row height (28px)
 * - Hover effects and action button visibility on hover
 *
 * Usage:
 * ```tsx
 * import { fileExplorerTheme } from './themes/file-explorer'
 *
 * <div className="rst__file-explorer-theme">
 *   <SortableTree
 *     treeData={treeData}
 *     onChange={setTreeData}
 *     theme={fileExplorerTheme}
 *     rowHeight={28}
 *   />
 * </div>
 * ```
 *
 * For dark mode, add the `rst__file-explorer-dark` class:
 * ```tsx
 * <div className="rst__file-explorer-theme rst__file-explorer-dark">
 *   ...
 * </div>
 * ```
 */
export const fileExplorerTheme = {
  nodeContentRenderer: FileExplorerNodeRenderer,
  scaffoldBlockPxWidth: 20,
  slideRegionSize: 50,
}

export { FileExplorerNodeRenderer }

// CSS class names for the theme wrapper
export const FILE_EXPLORER_THEME_CLASS = 'rst__file-explorer-theme'
export const FILE_EXPLORER_DARK_CLASS = 'rst__file-explorer-dark'
