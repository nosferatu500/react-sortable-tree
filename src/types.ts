// types.ts
import { ReactNode } from 'react'

export interface TreeItem {
  title: ReactNode | undefined
  subtitle: ReactNode | undefined
  expanded: boolean | undefined
  children: TreeItem[] | GetTreeItemChildrenFn | undefined
  [x: string]: unknown
}

export interface TreeNode {
  node: TreeItem
}

export interface TreePath {
  path: number[]
}

export interface TreeIndex {
  treeIndex: number
}

export interface FullTree {
  treeData: TreeItem[] | undefined
}

export interface NodeData extends TreeNode, TreePath, TreeIndex {}

export interface SearchData extends NodeData {
  searchQuery: string
}

export interface GetTreeItemChildren {
  done: (children: TreeItem[]) => void
  node: TreeItem
  path: number[]
  lowerSiblingCounts: number[]
  treeIndex: number
}

export type GetTreeItemChildrenFn = (data: GetTreeItemChildren) => void

export type GetNodeKeyFunction = (data: TreeIndex & TreeNode) => string | number

export interface TreeItemDropResult {
  node: TreeItem
  path: number[]
  treeIndex: number
  treeId: string
  minimumTreeIndex?: number
  depth?: number
}
