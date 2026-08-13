import type { ReactNode } from 'react'
import type { SearchData, TreeIndex, TreeItem, UnknownNodeData } from '../types'

export const defaultGetNodeKey = ({ treeIndex }: TreeIndex): number => treeIndex

// Cheap hack to get the text of a react object
const getReactElementText = (parent: ReactNode): string => {
  if (typeof parent === 'string') {
    return parent
  }
  if (typeof parent === 'number') {
    return String(parent)
  }

  const parentEle = parent as { props?: { children?: ReactNode } }

  if (
    !parentEle ||
    typeof parentEle !== 'object' ||
    !parentEle.props ||
    !parentEle.props.children
  ) {
    return ''
  }

  if (typeof parentEle.props.children === 'string') {
    return parentEle.props.children
  }

  if (Array.isArray(parentEle.props.children)) {
    return parentEle.props.children
      .map((child: ReactNode) => getReactElementText(child))
      .join('')
  }

  return getReactElementText(parentEle.props.children)
}

/**
 * Search for a query string inside one of a node's two text fields.
 *
 * `key` is the union rather than `string`: those are the only two fields this is
 * ever called with, and a described `TData` has no index signature to reach an
 * arbitrary one through.
 */
const stringSearch = <TData>(
  key: 'title' | 'subtitle',
  searchQuery: string,
  node: TreeItem<TData>,
  path: number[],
  treeIndex: number
) => {
  const value = node[key]
  if (typeof value === 'function') {
    // Search within text after calling its function to generate the text
    return String(value({ node, path, treeIndex })).includes(searchQuery)
  }
  if (typeof value === 'object') {
    // Search within text inside react elements
    return getReactElementText(value as ReactNode).includes(searchQuery)
  }

  // Search within string. `Boolean(value)` rather than a null check, to keep the
  // original truthiness test: a `null`, `''` or `0` title never matched, and
  // `String(null).includes('ul')` would start it matching.
  return Boolean(value) && String(value).includes(searchQuery)
}

export const defaultSearchMethod = <TData = UnknownNodeData>({
  node,
  path,
  treeIndex,
  searchQuery,
}: SearchData<TData>): boolean => {
  return (
    (stringSearch('title', searchQuery, node, path, treeIndex) ||
      stringSearch('subtitle', searchQuery, node, path, treeIndex)) ??
    false
  )
}
