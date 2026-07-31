import type { ReactNode } from 'react'

/**
 * Rendered node text. The function form is called with the node's own
 * `{ node, path, treeIndex }` at render time, which is how a title can depend
 * on where the node currently sits.
 */
export type TreeItemContent =
  // `undefined` is excluded because every use site is optional and would then
  // carry it twice.
  Exclude<ReactNode, undefined> | ((data: NodeData) => ReactNode)

export interface TreeItem {
  title?: TreeItemContent
  subtitle?: TreeItemContent
  expanded?: boolean
  children?: TreeItem[] | GetTreeItemChildrenFn
  [x: string]: unknown
}

export interface TreeNode {
  node: TreeItem
}

export interface TreePath {
  path: number[]
}

export type TreeKey = string | number

export interface TreePathInput {
  path: TreeKey[]
}

export interface TreeIndex {
  treeIndex: number
}

export interface FullTree {
  treeData: TreeItem[]
}

export interface NodeData extends TreeNode, TreePath, TreeIndex {}

export interface SearchData extends NodeData {
  searchQuery: string
}

export interface GetTreeItemChildren {
  /**
   * Callback form of delivering the loaded children.
   *
   * @deprecated Return the children array — or a promise for it — instead.
   * `done` keeps working and is not scheduled for removal.
   */
  done: (children: TreeItem[]) => void
  node: TreeItem
  path: TreeKey[]
  lowerSiblingCounts: number[]
  treeIndex: number
}

/**
 * Loader for a node whose children are fetched on demand. Deliver the children
 * by returning them, by returning a promise for them, or — deprecated — by
 * calling `done`. Returning (or resolving to) nothing leaves the node's
 * children untouched, so a loader that awaits and then calls `done` still
 * works.
 *
 * The tree it updates is the tree as it was when the loader was invoked, and a
 * loader for a node that is still a function may be invoked again on a later
 * tree change, so a loader that fetches should be idempotent or cached.
 */
export type GetTreeItemChildrenFn = (
  data: GetTreeItemChildren
) => TreeItem[] | Promise<TreeItem[] | undefined | void> | undefined | void

export type GetNodeKeyFunction = (data: TreeIndex & TreeNode) => string | number

export interface TreeItemDropResult {
  node: TreeItem
  path: number[]
  treeIndex: number
  treeId: string
  minimumTreeIndex?: number
  depth?: number
}
