import type { ReactNode } from 'react'
import type { SearchData, TreeIndex, TreeItem } from '../types'

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

// Search for a query string inside a node property
const stringSearch = (
  key: string,
  searchQuery: string,
  node: TreeItem,
  path: number[],
  treeIndex: number
) => {
  if (typeof node[key] === 'function') {
    // Search within text after calling its function to generate the text
    return String(node[key]({ node, path, treeIndex })).includes(searchQuery)
  }
  if (typeof node[key] === 'object') {
    // Search within text inside react elements
    return getReactElementText(node[key] as ReactNode).includes(searchQuery)
  }

  // Search within string
  return node[key] && String(node[key]).includes(searchQuery)
}

export const defaultSearchMethod = ({
  node,
  path,
  treeIndex,
  searchQuery,
}: SearchData): boolean => {
  return (
    (stringSearch('title', searchQuery, node, path, treeIndex) ||
      stringSearch('subtitle', searchQuery, node, path, treeIndex)) ??
    false
  )
}
