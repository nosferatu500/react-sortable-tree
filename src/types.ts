import type { ReactNode } from 'react'

/**
 * The custom fields of a node whose shape the consumer has not described.
 *
 * This is the default for every `TData` below, which is what keeps a bare
 * `TreeItem` exactly as permissive as it has always been. Describe your own
 * fields — `TreeItem<{ id: number }>` — to have them checked instead; the tree
 * and every helper thread that type through, so a `changeNodeAtPath` on a
 * `TreeItem<MyNode>[]` gives back a `TreeItem<MyNode>[]`.
 */
export interface UnknownNodeData {
  [x: string]: unknown
}

/**
 * Rendered node text. The function form is called with the node's own
 * `{ node, path, treeIndex }` at render time, which is how a title can depend
 * on where the node currently sits.
 */
export type TreeItemContent<TData = UnknownNodeData> =
  // `undefined` is excluded because every use site is optional and would then
  // carry it twice.
  Exclude<ReactNode, undefined> | ((data: NodeData<TData>) => ReactNode)

/**
 * The fields the tree itself understands, separate from the consumer's own.
 *
 * Split out so `TreeItem` can be the intersection of the two. It is exported
 * because that intersection is otherwise hard to talk about in a constraint.
 */
export interface TreeItemFields<TData = UnknownNodeData> {
  title?: TreeItemContent<TData>
  subtitle?: TreeItemContent<TData>
  expanded?: boolean
  children?: TreeItem<TData>[] | GetTreeItemChildrenFn<TData>
}

/**
 * A node.
 *
 * An intersection rather than an interface with an index signature, so that the
 * consumer's own fields can be described precisely when they want them checked
 * and left open when they do not. `TreeItem` on its own is
 * `TreeItem<UnknownNodeData>`, which is the previous shape unchanged.
 */
export type TreeItem<TData = UnknownNodeData> = TData & TreeItemFields<TData>

export interface TreeNode<TData = UnknownNodeData> {
  node: TreeItem<TData>
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

export interface FullTree<TData = UnknownNodeData> {
  treeData: TreeItem<TData>[]
}

export interface NodeData<TData = UnknownNodeData>
  extends TreeNode<TData>, TreePath, TreeIndex {}

export interface SearchData<TData = UnknownNodeData> extends NodeData<TData> {
  searchQuery: string
}

export interface GetTreeItemChildren<TData = UnknownNodeData> {
  node: TreeItem<TData>
  path: TreeKey[]
  lowerSiblingCounts: number[]
  treeIndex: number
}

/**
 * Loader for a node whose children are fetched on demand. Return the children,
 * or a promise for them; the node shows a loading indicator until they arrive.
 *
 * The tree it updates is the tree as it was when the loader was invoked, and a
 * loader for a node that is still a function may be invoked again on a later
 * tree change, so a loader that fetches should be idempotent or cached.
 */
export type GetTreeItemChildrenFn<TData = UnknownNodeData> = (
  data: GetTreeItemChildren<TData>
) => TreeItem<TData>[] | Promise<TreeItem<TData>[]>

export type GetNodeKeyFunction<TData = UnknownNodeData> = (
  data: TreeIndex & TreeNode<TData>
) => string | number

export interface TreeItemDropResult<TData = UnknownNodeData> {
  node: TreeItem<TData>
  path: number[]
  treeIndex: number
  treeId: string
  minimumTreeIndex?: number
  depth?: number
}
