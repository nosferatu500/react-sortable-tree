// @ts-nocheck

import {
  FullTree,
  GetNodeKeyFunction,
  GetTreeItemChildren,
  NodeData,
  SearchData,
  TreeIndex,
  TreeItem,
  TreeNode,
  TreePath,
} from '..'

export type WalkAndMapFunctionParameters = FullTree & {
  getNodeKey: GetNodeKeyFunction
  callback: Function
  ignoreCollapsed?: boolean | undefined
}

export interface FlatDataItem extends TreeNode, TreePath {
  lowerSiblingCounts: number[]
  parentNode: TreeItem
}

/**
 * Performs a depth-first traversal over all of the node descendants,
 * incrementing currentIndex by 1 for each
 */
const getNodeDataAtTreeIndexOrNextIndex = ({
  targetIndex,
  node,
  currentIndex,
  getNodeKey,
  path = [],
  lowerSiblingCounts = [],
  ignoreCollapsed = true,
  isPseudoRoot = false,
}: {
  targetIndex: number
  node: TreeItem
  currentIndex: number
  getNodeKey: GetNodeKeyFunction
  path: number[]
  lowerSiblingCounts: number[]
  ignoreCollapsed: boolean
  isPseudoRoot: boolean
}) => {
  // The pseudo-root is not considered in the path
  const selfPath = !isPseudoRoot
    ? [...path, getNodeKey({ node, treeIndex: currentIndex })]
    : []

  // Return target node when found
  if (currentIndex === targetIndex) {
    return {
      node,
      lowerSiblingCounts,
      path: selfPath,
    }
  }

  // Add one and continue for nodes with no children or hidden children
  if (!node?.children || (ignoreCollapsed && node?.expanded !== true)) {
    return { nextIndex: currentIndex + 1 }
  }

  // Iterate over each child and their descendants and return the
  // target node if childIndex reaches the targetIndex
  let childIndex = currentIndex + 1
  const childCount = node.children.length
  for (let i = 0; i < childCount; i += 1) {
    const result = getNodeDataAtTreeIndexOrNextIndex({
      ignoreCollapsed,
      getNodeKey,
      targetIndex,
      node: node.children[i],
      currentIndex: childIndex,
      lowerSiblingCounts: [...lowerSiblingCounts, childCount - i - 1],
      path: selfPath,
    })

    if (result.node) {
      return result
    }

    childIndex = result.nextIndex
  }

  // If the target node is not found, return the farthest traversed index
  return { nextIndex: childIndex }
}

export const getDescendantCount = ({
  node,
  ignoreCollapsed = true,
}: TreeNode & { ignoreCollapsed?: boolean | undefined }): number => {
  return (
    getNodeDataAtTreeIndexOrNextIndex({
      getNodeKey: () => {},
      ignoreCollapsed,
      node,
      currentIndex: 0,
      targetIndex: -1,
    }).nextIndex - 1
  )
}

const walkDescendants = ({
  callback,
  getNodeKey,
  ignoreCollapsed,
  isPseudoRoot = false,
  node,
  parentNode = undefined,
  currentIndex,
  path = [],
  lowerSiblingCounts = [],
}) => {
  // The pseudo-root is not considered in the path
  const selfPath = isPseudoRoot
    ? []
    : [...path, getNodeKey({ node, treeIndex: currentIndex })]
  const selfInfo = isPseudoRoot
    ? undefined
    : {
        node,
        parentNode,
        path: selfPath,
        lowerSiblingCounts,
        treeIndex: currentIndex,
      }

  if (!isPseudoRoot) {
    const callbackResult = callback(selfInfo)

    // Cut walk short if the callback returned false
    if (callbackResult === false) {
      return false
    }
  }

  // Return self on nodes with no children or hidden children
  if (
    !node.children ||
    (node.expanded !== true && ignoreCollapsed && !isPseudoRoot)
  ) {
    return currentIndex
  }

  // Get all descendants
  let childIndex = currentIndex
  const childCount = node.children.length
  if (typeof node.children !== 'function') {
    for (let i = 0; i < childCount; i += 1) {
      childIndex = walkDescendants({
        callback,
        getNodeKey,
        ignoreCollapsed,
        node: node.children[i],
        parentNode: isPseudoRoot ? undefined : node,
        currentIndex: childIndex + 1,
        lowerSiblingCounts: [...lowerSiblingCounts, childCount - i - 1],
        path: selfPath,
      })

      // Cut walk short if the callback returned false
      if (childIndex === false) {
        return false
      }
    }
  }

  return childIndex
}

const mapDescendants = ({
  callback,
  getNodeKey,
  ignoreCollapsed,
  isPseudoRoot = false,
  node,
  parentNode = undefined,
  currentIndex,
  path = [],
  lowerSiblingCounts = [],
}) => {
  const nextNode = { ...node }

  // The pseudo-root is not considered in the path
  const selfPath = isPseudoRoot
    ? []
    : [...path, getNodeKey({ node: nextNode, treeIndex: currentIndex })]
  const selfInfo = {
    node: nextNode,
    parentNode,
    path: selfPath,
    lowerSiblingCounts,
    treeIndex: currentIndex,
  }

  // Return self on nodes with no children or hidden children
  if (
    !nextNode.children ||
    (nextNode.expanded !== true && ignoreCollapsed && !isPseudoRoot)
  ) {
    return {
      treeIndex: currentIndex,
      node: callback(selfInfo),
    }
  }

  // Get all descendants
  let childIndex = currentIndex
  const childCount = nextNode.children.length
  if (typeof nextNode.children !== 'function') {
    nextNode.children = nextNode.children.map((child, i) => {
      const mapResult = mapDescendants({
        callback,
        getNodeKey,
        ignoreCollapsed,
        node: child,
        parentNode: isPseudoRoot ? undefined : nextNode,
        currentIndex: childIndex + 1,
        lowerSiblingCounts: [...lowerSiblingCounts, childCount - i - 1],
        path: selfPath,
      })
      childIndex = mapResult.treeIndex

      return mapResult.node
    })
  }

  return {
    node: callback(selfInfo),
    treeIndex: childIndex,
  }
}

export const getVisibleNodeCount = ({ treeData }: FullTree): number => {
  const traverse = (node) => {
    if (
      !node.children ||
      node.expanded !== true ||
      typeof node.children === 'function'
    ) {
      return 1
    }

    return (
      1 +
      node.children.reduce(
        (total, currentNode) => total + traverse(currentNode),
        0
      )
    )
  }

  return treeData.reduce(
    (total, currentNode) => total + traverse(currentNode),
    0
  )
}

export const getVisibleNodeInfoAtIndex = ({
  treeData,
  index: targetIndex,
  getNodeKey,
}: FullTree & {
  index: number
  getNodeKey: GetNodeKeyFunction
}): (TreeNode & TreePath & { lowerSiblingCounts: number[] }) | null => {
  if (!treeData || treeData.length === 0) {
    return undefined
  }

  // Call the tree traversal with a pseudo-root node
  const result = getNodeDataAtTreeIndexOrNextIndex({
    targetIndex,
    getNodeKey,
    node: {
      children: treeData,
      expanded: true,
    },
    currentIndex: -1,
    path: [],
    lowerSiblingCounts: [],
    isPseudoRoot: true,
  })

  if (result.node) {
    return result
  }

  return undefined
}

export const walk = ({
  treeData,
  getNodeKey,
  callback,
  ignoreCollapsed = true,
}: WalkAndMapFunctionParameters): void => {
  if (!treeData || treeData.length === 0) {
    return
  }

  walkDescendants({
    callback,
    getNodeKey,
    ignoreCollapsed,
    isPseudoRoot: true,
    node: { children: treeData },
    currentIndex: -1,
    path: [],
    lowerSiblingCounts: [],
  })
}

export const map = ({
  treeData,
  getNodeKey,
  callback,
  ignoreCollapsed = true,
}: WalkAndMapFunctionParameters): TreeItem[] => {
  if (!treeData || treeData.length === 0) {
    return []
  }

  return mapDescendants({
    callback,
    getNodeKey,
    ignoreCollapsed,
    isPseudoRoot: true,
    node: { children: treeData },
    currentIndex: -1,
    path: [],
    lowerSiblingCounts: [],
  }).node.children
}

export const toggleExpandedForAll = ({
  treeData,
  expanded = true,
}: FullTree & {
  expanded?: boolean | undefined
}): TreeItem[] => {
  return map({
    treeData,
    callback: ({ node }) => ({ ...node, expanded }),
    getNodeKey: ({ treeIndex }) => treeIndex,
    ignoreCollapsed: false,
  })
}

export const changeNodeAtPath = ({
  treeData,
  path,
  newNode,
  getNodeKey,
  ignoreCollapsed = true,
}: FullTree &
  TreePath & {
    newNode: Function | any
    getNodeKey: GetNodeKeyFunction
    ignoreCollapsed?: boolean | undefined
  }): TreeItem[] => {
  const RESULT_MISS = 'RESULT_MISS'
  const traverse = ({
    isPseudoRoot = false,
    node,
    currentTreeIndex,
    pathIndex,
  }) => {
    if (
      !isPseudoRoot &&
      getNodeKey({ node, treeIndex: currentTreeIndex }) !== path[pathIndex]
    ) {
      return RESULT_MISS
    }

    if (pathIndex >= path.length - 1) {
      // If this is the final location in the path, return its changed form
      return typeof newNode === 'function'
        ? newNode({ node, treeIndex: currentTreeIndex })
        : newNode
    }
    if (!node.children) {
      // If this node is part of the path, but has no children, return the unchanged node
      throw new Error('Path referenced children of node with no children.')
    }

    let nextTreeIndex = currentTreeIndex + 1
    for (let i = 0; i < node.children.length; i += 1) {
      const result = traverse({
        node: node.children[i],
        currentTreeIndex: nextTreeIndex,
        pathIndex: pathIndex + 1,
      })

      // If the result went down the correct path
      if (result !== RESULT_MISS) {
        if (result) {
          // If the result was truthy (in this case, an object),
          //  pass it to the next level of recursion up
          return {
            ...node,
            children: [
              ...node.children.slice(0, i),
              result,
              ...node.children.slice(i + 1),
            ],
          }
        }
        // If the result was falsy (returned from the newNode function), then
        //  delete the node from the array.
        return {
          ...node,
          children: [
            ...node.children.slice(0, i),
            ...node.children.slice(i + 1),
          ],
        }
      }

      nextTreeIndex +=
        1 + getDescendantCount({ node: node.children[i], ignoreCollapsed })
    }

    return RESULT_MISS
  }

  // Use a pseudo-root node in the beginning traversal
  const result = traverse({
    node: { children: treeData },
    currentTreeIndex: -1,
    pathIndex: -1,
    isPseudoRoot: true,
  })

  if (result === RESULT_MISS) {
    throw new Error('No node found at the given path.')
  }

  return result.children
}

export const removeNodeAtPath = ({
  treeData,
  path,
  getNodeKey,
  ignoreCollapsed = true,
}: FullTree &
  TreePath & {
    getNodeKey: GetNodeKeyFunction
    ignoreCollapsed?: boolean | undefined
  }): TreeItem[] => {
  return changeNodeAtPath({
    treeData,
    path,
    getNodeKey,
    ignoreCollapsed,
    newNode: undefined, // Delete the node
  })
}

export const removeNode = ({
  treeData,
  path,
  getNodeKey,
  ignoreCollapsed = true,
}: FullTree &
  TreePath & {
    getNodeKey: GetNodeKeyFunction
    ignoreCollapsed?: boolean | undefined
  }): (FullTree & TreeNode & TreeIndex) | undefined => {
  let removedNode
  let removedTreeIndex
  const nextTreeData = changeNodeAtPath({
    treeData,
    path,
    getNodeKey,
    ignoreCollapsed,
    newNode: ({ node, treeIndex }) => {
      // Store the target node and delete it from the tree
      removedNode = node
      removedTreeIndex = treeIndex

      return undefined
    },
  })

  return {
    treeData: nextTreeData,
    node: removedNode,
    treeIndex: removedTreeIndex,
  }
}

export const getNodeAtPath = ({
  treeData,
  path,
  getNodeKey,
  ignoreCollapsed = true,
}: FullTree &
  TreePath & {
    getNodeKey: GetNodeKeyFunction
    ignoreCollapsed?: boolean | undefined
  }): (TreeNode & TreeIndex) | null => {
  let foundNodeInfo

  try {
    changeNodeAtPath({
      treeData,
      path,
      getNodeKey,
      ignoreCollapsed,
      newNode: ({ node, treeIndex }: GetTreeItemChildren) => {
        foundNodeInfo = { node, treeIndex }
        return node
      },
    })
  } catch {
    // Ignore the error -- the null return will be explanation enough
  }

  return foundNodeInfo
}

export const addNodeUnderParent = ({
  treeData,
  newNode,
  parentKey = undefined,
  getNodeKey,
  ignoreCollapsed = true,
  expandParent = false,
  addAsFirstChild = false,
}: FullTree & {
  newNode: TreeItem
  parentKey?: number | string | undefined | null
  getNodeKey: GetNodeKeyFunction
  ignoreCollapsed?: boolean | undefined
  expandParent?: boolean | undefined
  addAsFirstChild?: boolean | undefined
}): FullTree & TreeIndex => {
  if (parentKey === null || parentKey === undefined) {
    return addAsFirstChild
      ? {
          treeData: [newNode, ...(treeData || [])],
          treeIndex: 0,
        }
      : {
          treeData: [...(treeData || []), newNode],
          treeIndex: (treeData || []).length,
        }
  }

  let insertedTreeIndex
  let hasBeenAdded = false
  const changedTreeData = map({
    treeData,
    getNodeKey,
    ignoreCollapsed,
    callback: ({ node, treeIndex, path }: GetTreeItemChildren) => {
      const key = path ? path[path.length - 1] : undefined
      // Return nodes that are not the parent as-is
      if (hasBeenAdded || key !== parentKey) {
        return node
      }
      hasBeenAdded = true

      const parentNode = {
        ...node,
      }

      if (expandParent) {
        parentNode.expanded = true
      }

      // If no children exist yet, just add the single newNode
      if (!parentNode.children) {
        insertedTreeIndex = treeIndex + 1
        return {
          ...parentNode,
          children: [newNode],
        }
      }

      if (typeof parentNode.children === 'function') {
        throw new TypeError('Cannot add to children defined by a function')
      }

      let nextTreeIndex = treeIndex + 1
      for (let i = 0; i < parentNode.children.length; i += 1) {
        nextTreeIndex +=
          1 +
          getDescendantCount({ node: parentNode.children[i], ignoreCollapsed })
      }

      insertedTreeIndex = nextTreeIndex

      const children = addAsFirstChild
        ? [newNode, ...parentNode.children]
        : [...parentNode.children, newNode]

      return {
        ...parentNode,
        children,
      }
    },
  })

  if (!hasBeenAdded) {
    throw new Error('No node found with the given key.')
  }

  return {
    treeData: changedTreeData,
    treeIndex: insertedTreeIndex,
  }
}

const addNodeAtDepthAndIndex = ({
  targetDepth,
  minimumTreeIndex,
  newNode,
  ignoreCollapsed,
  expandParent,
  isPseudoRoot = false,
  isLastChild,
  node,
  currentIndex,
  currentDepth,
  getNodeKey,
  path = [],
}) => {
  const selfPath = (n) =>
    isPseudoRoot
      ? []
      : [...path, getNodeKey({ node: n, treeIndex: currentIndex })]

  // If the current position is the only possible place to add, add it
  if (
    currentIndex >= minimumTreeIndex - 1 ||
    (isLastChild && !(node.children && node.children.length > 0))
  ) {
    if (typeof node.children === 'function') {
      throw new TypeError('Cannot add to children defined by a function')
    } else {
      const extraNodeProps = expandParent ? { expanded: true } : {}
      const nextNode = {
        ...node,

        ...extraNodeProps,
        children: node.children ? [newNode, ...node.children] : [newNode],
      }

      return {
        node: nextNode,
        nextIndex: currentIndex + 2,
        insertedTreeIndex: currentIndex + 1,
        parentPath: selfPath(nextNode),
        parentNode: isPseudoRoot ? undefined : nextNode,
      }
    }
  }

  // If this is the target depth for the insertion,
  // i.e., where the newNode can be added to the current node's children
  if (currentDepth >= targetDepth - 1) {
    // Skip over nodes with no children or hidden children
    if (
      !node.children ||
      typeof node.children === 'function' ||
      (node.expanded !== true && ignoreCollapsed && !isPseudoRoot)
    ) {
      return { node, nextIndex: currentIndex + 1 }
    }

    // Scan over the children to see if there's a place among them that fulfills
    // the minimumTreeIndex requirement
    let childIndex = currentIndex + 1
    let insertedTreeIndex
    let insertIndex
    for (let i = 0; i < node.children.length; i += 1) {
      // If a valid location is found, mark it as the insertion location and
      // break out of the loop
      if (childIndex >= minimumTreeIndex) {
        insertedTreeIndex = childIndex
        insertIndex = i
        break
      }

      // Increment the index by the child itself plus the number of descendants it has
      childIndex +=
        1 + getDescendantCount({ node: node.children[i], ignoreCollapsed })
    }

    // If no valid indices to add the node were found
    if (insertIndex === null || insertIndex === undefined) {
      // If the last position in this node's children is less than the minimum index
      // and there are more children on the level of this node, return without insertion
      if (childIndex < minimumTreeIndex && !isLastChild) {
        return { node, nextIndex: childIndex }
      }

      // Use the last position in the children array to insert the newNode
      insertedTreeIndex = childIndex
      insertIndex = node.children.length
    }

    // Insert the newNode at the insertIndex
    const nextNode = {
      ...node,
      children: [
        ...node.children.slice(0, insertIndex),
        newNode,
        ...node.children.slice(insertIndex),
      ],
    }

    // Return node with successful insert result
    return {
      node: nextNode,
      nextIndex: childIndex,
      insertedTreeIndex,
      parentPath: selfPath(nextNode),
      parentNode: isPseudoRoot ? undefined : nextNode,
    }
  }

  // Skip over nodes with no children or hidden children
  if (
    !node.children ||
    typeof node.children === 'function' ||
    (node.expanded !== true && ignoreCollapsed && !isPseudoRoot)
  ) {
    return { node, nextIndex: currentIndex + 1 }
  }

  // Get all descendants
  let insertedTreeIndex
  let pathFragment
  let parentNode
  let childIndex = currentIndex + 1
  let newChildren = node.children
  if (typeof newChildren !== 'function') {
    newChildren = newChildren.map((child, i) => {
      if (insertedTreeIndex !== null && insertedTreeIndex !== undefined) {
        return child
      }

      const mapResult = addNodeAtDepthAndIndex({
        targetDepth,
        minimumTreeIndex,
        newNode,
        ignoreCollapsed,
        expandParent,
        isLastChild: isLastChild && i === newChildren.length - 1,
        node: child,
        currentIndex: childIndex,
        currentDepth: currentDepth + 1,
        getNodeKey,
        path: [], // Cannot determine the parent path until the children have been processed
      })

      if ('insertedTreeIndex' in mapResult) {
        ;({
          insertedTreeIndex,
          parentNode,
          parentPath: pathFragment,
        } = mapResult)
      }

      childIndex = mapResult.nextIndex

      return mapResult.node
    })
  }

  const nextNode = { ...node, children: newChildren }
  const result = {
    node: nextNode,
    nextIndex: childIndex,
  }

  if (insertedTreeIndex !== null && insertedTreeIndex !== undefined) {
    result.insertedTreeIndex = insertedTreeIndex
    result.parentPath = [...selfPath(nextNode), ...pathFragment]
    result.parentNode = parentNode
  }

  return result
}

export const insertNode = ({
  treeData,
  depth: targetDepth,
  minimumTreeIndex,
  newNode,
  getNodeKey,
  ignoreCollapsed = true,
  expandParent = false,
}: FullTree & {
  depth: number
  newNode: TreeItem
  minimumTreeIndex: number
  ignoreCollapsed?: boolean | undefined
  expandParent?: boolean | undefined
  getNodeKey: GetNodeKeyFunction
}): FullTree & TreeIndex & TreePath & { parentNode: TreeItem | null } => {
  if (!treeData && targetDepth === 0) {
    return {
      treeData: [newNode],
      treeIndex: 0,
      path: [getNodeKey({ node: newNode, treeIndex: 0 })],
      parentNode: undefined,
    }
  }

  const insertResult = addNodeAtDepthAndIndex({
    targetDepth,
    minimumTreeIndex,
    newNode,
    ignoreCollapsed,
    expandParent,
    getNodeKey,
    isPseudoRoot: true,
    isLastChild: true,
    node: { children: treeData },
    currentIndex: -1,
    currentDepth: -1,
  })

  if (!('insertedTreeIndex' in insertResult)) {
    throw new Error('No suitable position found to insert.')
  }

  const treeIndex = insertResult.insertedTreeIndex
  return {
    treeData: insertResult.node.children,
    treeIndex,
    path: [
      ...insertResult.parentPath,
      getNodeKey({ node: newNode, treeIndex }),
    ],
    parentNode: insertResult.parentNode,
  }
}

export const getFlatDataFromTree = ({
  treeData,
  getNodeKey,
  ignoreCollapsed = true,
}: FullTree & {
  getNodeKey: GetNodeKeyFunction
  ignoreCollapsed?: boolean | undefined
}): FlatDataItem[] => {
  if (!treeData || treeData.length === 0) {
    return []
  }

  const flattened = []
  walk({
    treeData,
    getNodeKey,
    ignoreCollapsed,
    callback: (nodeInfo) => {
      flattened.push(nodeInfo)
    },
  })

  return flattened
}

export const getTreeFromFlatData = ({
  flatData,
  getKey = (node) => node.id,
  getParentKey = (node) => node.parentId,
  rootKey = '0',
}) => {
  if (!flatData) {
    return []
  }

  const childrenToParents = {}
  for (const child of flatData) {
    const parentKey = getParentKey(child)

    if (parentKey in childrenToParents) {
      childrenToParents[parentKey].push(child)
    } else {
      childrenToParents[parentKey] = [child]
    }
  }

  if (!(rootKey in childrenToParents)) {
    return []
  }

  const trav = (parent) => {
    const parentKey = getKey(parent)
    if (parentKey in childrenToParents) {
      return {
        ...parent,
        children: childrenToParents[parentKey].map((child) => trav(child)),
      }
    }

    return { ...parent }
  }

  return childrenToParents[rootKey].map((child) => trav(child))
}

export const isDescendant = (older: TreeItem, younger: TreeItem): boolean => {
  return (
    !!older.children &&
    typeof older.children !== 'function' &&
    older.children.some(
      (child) => child === younger || isDescendant(child, younger)
    )
  )
}

export const getDepth = (node: TreeItem, depth?: number = 0): number => {
  if (!node.children) {
    return depth
  }

  if (typeof node.children === 'function') {
    return depth + 1
  }

  return node.children.reduce(
    (deepest, child) => Math.max(deepest, getDepth(child, depth + 1)),
    depth
  )
}

export const find = ({
  getNodeKey,
  treeData,
  searchQuery,
  searchMethod,
  searchFocusOffset,
  expandAllMatchPaths = false,
  expandFocusMatchPaths = true,
}: FullTree & {
  getNodeKey: GetNodeKeyFunction
  searchQuery?: string | number | undefined
  searchMethod: (data: SearchData) => boolean
  searchFocusOffset?: number | undefined
  expandAllMatchPaths?: boolean | undefined
  expandFocusMatchPaths?: boolean | undefined
}): { matches: NodeData[] } & FullTree => {
  let matchCount = 0
  const trav = ({ isPseudoRoot = false, node, currentIndex, path = [] }) => {
    let matches: any[] = []
    let isSelfMatch = false
    let hasFocusMatch = false
    // The pseudo-root is not considered in the path
    const selfPath = isPseudoRoot
      ? []
      : [...path, getNodeKey({ node, treeIndex: currentIndex })]
    const extraInfo = isPseudoRoot
      ? undefined
      : {
          path: selfPath,
          treeIndex: currentIndex,
        }

    // Nodes with with children that aren't lazy
    const hasChildren =
      node.children &&
      typeof node.children !== 'function' &&
      node.children.length > 0

    // Examine the current node to see if it is a match
    if (!isPseudoRoot && searchMethod({ ...extraInfo, node, searchQuery })) {
      if (matchCount === searchFocusOffset) {
        hasFocusMatch = true
      }

      // Keep track of the number of matching nodes, so we know when the searchFocusOffset
      //  is reached
      matchCount += 1

      // We cannot add this node to the matches right away, as it may be changed
      //  during the search of the descendants. The entire node is used in
      //  comparisons between nodes inside the `matches` and `treeData` results
      //  of this method (`find`)
      isSelfMatch = true
    }

    let childIndex = currentIndex
    const newNode = { ...node }
    if (hasChildren) {
      // Get all descendants
      newNode.children = newNode.children.map((child) => {
        const mapResult = trav({
          node: child,
          currentIndex: childIndex + 1,
          path: selfPath,
        })

        // Ignore hidden nodes by only advancing the index counter to the returned treeIndex
        // if the child is expanded.
        //
        // The child could have been expanded from the start,
        // or expanded due to a matching node being found in its descendants
        if (mapResult.node.expanded) {
          childIndex = mapResult.treeIndex
        } else {
          childIndex += 1
        }

        if (mapResult.matches.length > 0 || mapResult.hasFocusMatch) {
          matches = [...matches, ...mapResult.matches]
          if (mapResult.hasFocusMatch) {
            hasFocusMatch = true
          }

          // Expand the current node if it has descendants matching the search
          // and the settings are set to do so.
          if (
            (expandAllMatchPaths && mapResult.matches.length > 0) ||
            ((expandAllMatchPaths || expandFocusMatchPaths) &&
              mapResult.hasFocusMatch)
          ) {
            newNode.expanded = true
          }
        }

        return mapResult.node
      })
    }

    // Cannot assign a treeIndex to hidden nodes
    if (!isPseudoRoot && !newNode.expanded) {
      matches = matches.map((match) => ({
        ...match,
        treeIndex: undefined,
      }))
    }

    // Add this node to the matches if it fits the search criteria.
    // This is performed at the last minute so newNode can be sent in its final form.
    if (isSelfMatch) {
      matches = [{ ...extraInfo, node: newNode }, ...matches]
    }

    return {
      node: matches.length > 0 ? newNode : node,
      matches,
      hasFocusMatch,
      treeIndex: childIndex,
    }
  }

  const result = trav({
    node: { children: treeData },
    isPseudoRoot: true,
    currentIndex: -1,
  })

  return {
    matches: result.matches,
    treeData: result.node.children,
  }
}
