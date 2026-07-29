import { original, produce } from 'immer'
import {
  FullTree,
  GetNodeKeyFunction,
  NodeData,
  SearchData,
  TreeIndex,
  TreeItem,
  TreeNode,
  TreePath,
} from '../types'

const STOP_WALK = Number.NEGATIVE_INFINITY

export interface FlatDataItem extends TreeNode {
  path: Array<string | number>
  lowerSiblingCounts: number[]
  parentNode?: TreeItem
}

type WalkInfo = {
  node: TreeItem
  parentNode?: TreeItem
  path: Array<string | number>
  lowerSiblingCounts: number[]
  treeIndex: number
}

type NodeCallback = (nodeInfo: WalkInfo) => unknown

export type WalkAndMapFunctionParameters = FullTree & {
  getNodeKey: GetNodeKeyFunction
  callback: NodeCallback
  ignoreCollapsed?: boolean
}

type NodeDataResult = {
  node?: TreeItem
  lowerSiblingCounts?: number[]
  path?: Array<string | number>
  nextIndex?: number
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
  path?: Array<string | number>
  lowerSiblingCounts?: number[]
  ignoreCollapsed?: boolean
  isPseudoRoot?: boolean
}): NodeDataResult => {
  // The pseudo-root is not considered in the path
  const selfPath = isPseudoRoot
    ? []
    : [...path, getNodeKey({ node, treeIndex: currentIndex })]

  // Return target node when found
  if (currentIndex === targetIndex) {
    return {
      node,
      lowerSiblingCounts,
      path: selfPath,
    }
  }

  // Add one and continue for nodes with no children or hidden children
  if (
    !node?.children ||
    typeof node.children === 'function' ||
    (ignoreCollapsed && node?.expanded !== true)
  ) {
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

    childIndex = result.nextIndex!
  }

  // If the target node is not found, return the farthest traversed index
  return { nextIndex: childIndex }
}

export const getDescendantCount = ({
  node,
  ignoreCollapsed = true,
}: TreeNode & { ignoreCollapsed?: boolean }): number => {
  return (
    getNodeDataAtTreeIndexOrNextIndex({
      getNodeKey: () => 0,
      ignoreCollapsed,
      node,
      currentIndex: 0,
      targetIndex: -1,
    }).nextIndex! - 1
  )
}

type WalkDescendantsParams = {
  callback: NodeCallback
  getNodeKey: GetNodeKeyFunction
  ignoreCollapsed: boolean
  isPseudoRoot?: boolean
  node: TreeItem
  parentNode?: TreeItem
  currentIndex: number
  path?: Array<string | number>
  lowerSiblingCounts?: number[]
}

const walkChildren = (
  params: WalkDescendantsParams,
  selfPath: Array<string | number>,
  childIndex: number
): number => {
  const {
    callback,
    getNodeKey,
    ignoreCollapsed,
    isPseudoRoot,
    node,
    lowerSiblingCounts = [],
  } = params
  if (!node.children || typeof node.children === 'function') return childIndex

  let idx = childIndex
  const childCount = node.children.length
  for (let i = 0; i < childCount; i += 1) {
    const result = walkDescendants({
      callback,
      getNodeKey,
      ignoreCollapsed,
      node: node.children[i],
      parentNode: isPseudoRoot ? undefined : node,
      currentIndex: idx + 1,
      lowerSiblingCounts: [...lowerSiblingCounts, childCount - i - 1],
      path: selfPath,
    })
    if (result === STOP_WALK) return STOP_WALK
    idx = result
  }
  return idx
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
}: WalkDescendantsParams): number => {
  const selfPath = isPseudoRoot
    ? []
    : [...path, getNodeKey({ node, treeIndex: currentIndex })]

  if (!isPseudoRoot) {
    const selfInfo = {
      node,
      parentNode,
      path: selfPath,
      lowerSiblingCounts,
      treeIndex: currentIndex,
    }
    if (callback(selfInfo) === false) return STOP_WALK
  }

  if (
    !node.children ||
    (node.expanded !== true && ignoreCollapsed && !isPseudoRoot)
  ) {
    return currentIndex
  }

  return walkChildren(
    {
      callback,
      getNodeKey,
      ignoreCollapsed,
      isPseudoRoot,
      node,
      parentNode,
      currentIndex,
      path,
      lowerSiblingCounts,
    },
    selfPath,
    currentIndex
  )
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
}: {
  callback: NodeCallback
  getNodeKey: GetNodeKeyFunction
  ignoreCollapsed: boolean
  isPseudoRoot?: boolean
  node: TreeItem
  parentNode?: TreeItem
  currentIndex: number
  path?: Array<string | number>
  lowerSiblingCounts?: number[]
}): { node: TreeItem; treeIndex: number } => {
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
      node: callback(selfInfo) as TreeItem,
    }
  }

  // Get all descendants
  let childIndex = currentIndex
  const childCount = nextNode.children.length
  if (typeof nextNode.children !== 'function') {
    nextNode.children = nextNode.children.map((child: TreeItem, i: number) => {
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
    node: callback(selfInfo) as TreeItem,
    treeIndex: childIndex,
  }
}

export const getVisibleNodeCount = ({ treeData }: FullTree): number => {
  const traverse = (node: TreeItem): number => {
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
        (total: number, currentNode: TreeItem) => total + traverse(currentNode),
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
    return null
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
    ignoreCollapsed: true,
    isPseudoRoot: true,
  })

  if (result.node) {
    return result as TreeNode & TreePath & { lowerSiblingCounts: number[] }
  }

  return null
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
  }).node.children as TreeItem[]
}

export const toggleExpandedForAll = ({
  treeData,
  expanded = true,
}: FullTree & {
  expanded?: boolean
}): TreeItem[] => {
  return map({
    treeData,
    callback: ({ node }: { node: TreeItem }) => ({ ...node, expanded }),
    getNodeKey: ({ treeIndex }: TreeIndex) => treeIndex,
    ignoreCollapsed: false,
  })
}

type NewNodeArg =
  | ((info: {
      node: TreeItem
      treeIndex: number
    }) => TreeItem | null | undefined)
  | TreeItem
  | null
  | undefined

type PseudoRoot = { children: TreeItem[] }

const findChildByKey = (
  children: TreeItem[],
  key: string | number,
  startTreeIndex: number,
  getNodeKey: GetNodeKeyFunction,
  ignoreCollapsed: boolean
): { foundIndex: number; treeIndex: number } => {
  let treeIndex = startTreeIndex
  for (const [j, child] of children.entries()) {
    const childIndex = treeIndex + 1
    if (getNodeKey({ node: child, treeIndex: childIndex }) === key) {
      return { foundIndex: j, treeIndex: childIndex }
    }
    treeIndex += 1 + getDescendantCount({ node: child, ignoreCollapsed })
  }
  return { foundIndex: -1, treeIndex }
}

const applyNewNode = (
  children: TreeItem[],
  foundIndex: number,
  treeIndex: number,
  newNode: NewNodeArg
): void => {
  const targetNode = children[foundIndex]
  const result =
    typeof newNode === 'function'
      ? newNode({ node: targetNode, treeIndex })
      : newNode

  if (result === undefined || result === null) {
    children.splice(foundIndex, 1)
  } else {
    children[foundIndex] = result
  }
}

const findAndUpdateNode = (
  root: PseudoRoot,
  path: number[],
  newNode: NewNodeArg,
  getNodeKey: GetNodeKeyFunction,
  ignoreCollapsed: boolean
): void => {
  let node = root as PseudoRoot & TreeItem
  let currentTreeIndex = -1

  for (const [i, key] of path.entries()) {
    if (!node.children) {
      throw new Error('Path referenced children of node with no children.')
    }

    const { foundIndex, treeIndex } = findChildByKey(
      node.children,
      key,
      currentTreeIndex,
      getNodeKey,
      ignoreCollapsed
    )

    if (foundIndex === -1) {
      throw new Error('No node found at the given path.')
    }

    currentTreeIndex = treeIndex

    if (i === path.length - 1) {
      applyNewNode(node.children, foundIndex, currentTreeIndex, newNode)
    } else {
      node = node.children[foundIndex] as PseudoRoot & TreeItem
    }
  }
}

export const changeNodeAtPath = ({
  treeData,
  path,
  newNode,
  getNodeKey,
  ignoreCollapsed = true,
}: FullTree &
  TreePath & {
    newNode: NewNodeArg
    getNodeKey: GetNodeKeyFunction
    ignoreCollapsed?: boolean
  }): TreeItem[] => {
  if (!treeData || treeData.length === 0) return []

  return produce(treeData, (draft) => {
    findAndUpdateNode(
      { children: draft },
      path,
      newNode,
      getNodeKey,
      ignoreCollapsed
    )
  })
}

type TreePathParams = FullTree &
  TreePath & {
    getNodeKey: GetNodeKeyFunction
    ignoreCollapsed?: boolean
  }

export const removeNodeAtPath = ({
  treeData,
  path,
  getNodeKey,
  ignoreCollapsed = true,
}: TreePathParams): TreeItem[] => {
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
}: TreePathParams): (FullTree & TreeNode & TreeIndex) | undefined => {
  let removedNode: TreeItem | undefined
  let removedTreeIndex: number | undefined
  let nextTreeData: TreeItem[]
  try {
    nextTreeData = changeNodeAtPath({
      treeData,
      path,
      getNodeKey,
      ignoreCollapsed,
      newNode: ({ node, treeIndex }: { node: TreeItem; treeIndex: number }) => {
        removedNode = original(node) || node

        removedTreeIndex = treeIndex

        return undefined
      },
    })
  } catch {
    return undefined
  }

  return {
    treeData: nextTreeData,
    node: removedNode!,
    treeIndex: removedTreeIndex!,
  }
}

export const getNodeAtPath = ({
  treeData,
  path,
  getNodeKey,
  ignoreCollapsed = true,
}: TreePathParams): (TreeNode & TreeIndex) | null => {
  let foundNodeInfo: (TreeNode & TreeIndex) | undefined

  try {
    changeNodeAtPath({
      treeData,
      path,
      getNodeKey,
      ignoreCollapsed,
      newNode: ({ node, treeIndex }: { node: TreeItem; treeIndex: number }) => {
        foundNodeInfo = { node: original(node) || node, treeIndex }
        return node
      },
    })
  } catch {
    // Ignore the error -- the null return will be explanation enough
  }

  return foundNodeInfo ?? null
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
  parentKey: number | string | undefined | null
  getNodeKey: GetNodeKeyFunction
  ignoreCollapsed?: boolean
  expandParent?: boolean
  addAsFirstChild?: boolean
}): FullTree & TreeIndex => {
  if (parentKey === null || parentKey === undefined) {
    const newTreeData = addAsFirstChild
      ? [newNode, ...(treeData || [])]
      : [...(treeData || []), newNode]
    return {
      treeData: newTreeData,
      treeIndex: addAsFirstChild ? 0 : (treeData || []).length,
    }
  }

  let insertedTreeIndex = -1
  let found = false

  const insertIntoParentNode = (node: TreeItem, nodeIndex: number): boolean => {
    if (expandParent) node.expanded = true
    if (!node.children) {
      node.children = [newNode]
      insertedTreeIndex = nodeIndex + 1
      return true
    }
    if (typeof node.children === 'function') {
      throw new TypeError('Cannot add to children defined by a function')
    }
    let childIndexOffset = nodeIndex + 1
    if (!addAsFirstChild) {
      for (const child of node.children) {
        childIndexOffset +=
          1 + getDescendantCount({ node: child, ignoreCollapsed })
      }
    }
    insertedTreeIndex = childIndexOffset
    if (addAsFirstChild) {
      node.children.unshift(newNode)
    } else {
      node.children.push(newNode)
    }
    return true
  }

  const findAndInsert = (
    nodes: TreeItem[],
    currentTreeIndex: number
  ): number => {
    let indexCounter = currentTreeIndex
    for (const node of nodes) {
      const key = getNodeKey({ node, treeIndex: indexCounter })
      if (key === parentKey) {
        found = true
        insertIntoParentNode(node, indexCounter)
        return -1
      }
      const descendants = getDescendantCount({ node, ignoreCollapsed })
      const nextIndex = indexCounter + 1 + descendants
      if (
        node.children &&
        typeof node.children !== 'function' &&
        (node.expanded || !ignoreCollapsed)
      ) {
        const result = findAndInsert(node.children, indexCounter + 1)
        if (result === -1) return -1
      }
      indexCounter = nextIndex
    }
    return indexCounter
  }

  const nextTreeData = produce(treeData, (draft) => {
    findAndInsert(draft, 0)
  })

  if (!found) {
    throw new Error('No node found with the given key.')
  }

  return {
    treeData: nextTreeData,
    treeIndex: insertedTreeIndex,
  }
}

interface AddNodeResult {
  node: TreeItem
  nextIndex: number
  insertedTreeIndex?: number
  parentPath?: Array<string | number>
  parentNode?: TreeItem
}

interface AddNodeAtDepthParams {
  targetDepth: number
  minimumTreeIndex: number
  newNode: TreeItem
  ignoreCollapsed: boolean
  expandParent: boolean
  isPseudoRoot?: boolean
  isLastChild: boolean
  node: TreeItem
  currentIndex: number
  currentDepth: number
  getNodeKey: GetNodeKeyFunction
  path?: Array<string | number>
}

const makeSelfPath = (
  params: AddNodeAtDepthParams,
  n: TreeItem
): Array<string | number> => {
  const { isPseudoRoot, path = [], getNodeKey, currentIndex } = params
  return isPseudoRoot
    ? []
    : [...path, getNodeKey({ node: n, treeIndex: currentIndex })]
}

const isChildrenHidden = (
  node: TreeItem,
  ignoreCollapsed: boolean,
  isPseudoRoot: boolean
): boolean =>
  !node.children ||
  typeof node.children === 'function' ||
  (node.expanded !== true && ignoreCollapsed && !isPseudoRoot)

const insertAtCurrentPosition = (
  params: AddNodeAtDepthParams
): AddNodeResult | undefined => {
  const {
    currentIndex,
    minimumTreeIndex,
    isLastChild,
    node,
    expandParent,
    isPseudoRoot = false,
    newNode,
  } = params
  const isOnlyOption =
    currentIndex >= minimumTreeIndex - 1 ||
    (isLastChild && !(node.children && node.children.length > 0))
  if (!isOnlyOption) return undefined

  if (typeof node.children === 'function') {
    throw new TypeError('Cannot add to children defined by a function')
  }
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
    parentPath: makeSelfPath(params, nextNode),
    parentNode: isPseudoRoot ? undefined : nextNode,
  }
}

const findInsertAtDepth = (params: AddNodeAtDepthParams): AddNodeResult => {
  const {
    node,
    currentIndex,
    minimumTreeIndex,
    isLastChild,
    isPseudoRoot = false,
    ignoreCollapsed,
    newNode,
  } = params
  if (isChildrenHidden(node, ignoreCollapsed, isPseudoRoot)) {
    return { node, nextIndex: currentIndex + 1 }
  }

  // Scan children to find first position that fulfills minimumTreeIndex
  const children = node.children as TreeItem[]
  let childIndex = currentIndex + 1
  let insertedTreeIndex: number | undefined
  let insertIndex: number | undefined
  for (const [i, child] of children.entries()) {
    if (childIndex >= minimumTreeIndex) {
      insertedTreeIndex = childIndex
      insertIndex = i
      break
    }
    childIndex += 1 + getDescendantCount({ node: child, ignoreCollapsed })
  }

  if (insertIndex === undefined) {
    if (childIndex < minimumTreeIndex && !isLastChild) {
      return { node, nextIndex: childIndex }
    }
    insertedTreeIndex = childIndex
    insertIndex = children.length
  }

  const nextNode = {
    ...node,
    children: children.toSpliced(insertIndex, 0, newNode),
  }
  return {
    node: nextNode,
    nextIndex: childIndex,
    insertedTreeIndex,
    parentPath: makeSelfPath(params, nextNode),
    parentNode: isPseudoRoot ? undefined : nextNode,
  }
}

const traverseChildrenForInsert = (
  params: AddNodeAtDepthParams
): AddNodeResult => {
  const {
    node,
    currentIndex,
    isPseudoRoot = false,
    isLastChild,
    ignoreCollapsed,
  } = params
  if (isChildrenHidden(node, ignoreCollapsed, isPseudoRoot)) {
    return { node, nextIndex: currentIndex + 1 }
  }

  const children = node.children as TreeItem[]
  let insertedTreeIndex: number | undefined
  let pathFragment: Array<string | number> | undefined
  let parentNode: TreeItem | undefined
  let childIndex = currentIndex + 1

  const newChildren = children.map((child: TreeItem, i: number) => {
    if (insertedTreeIndex !== undefined) return child

    const mapResult = addNodeAtDepthAndIndex({
      ...params,
      isLastChild: isLastChild && i === children.length - 1,
      node: child,
      currentIndex: childIndex,
      currentDepth: params.currentDepth + 1,
      path: [], // Cannot determine the parent path until children are processed
    })

    if (mapResult.insertedTreeIndex !== undefined) {
      ;({ insertedTreeIndex, parentNode, parentPath: pathFragment } = mapResult)
    }
    childIndex = mapResult.nextIndex
    return mapResult.node
  })

  const nextNode = { ...node, children: newChildren }
  const result: AddNodeResult = { node: nextNode, nextIndex: childIndex }
  if (insertedTreeIndex !== undefined) {
    result.insertedTreeIndex = insertedTreeIndex
    result.parentPath = [
      ...makeSelfPath(params, nextNode),
      ...(pathFragment ?? []),
    ]
    result.parentNode = parentNode
  }
  return result
}

const addNodeAtDepthAndIndex = (
  params: AddNodeAtDepthParams
): AddNodeResult => {
  const earlyResult = insertAtCurrentPosition(params)
  if (earlyResult) return earlyResult
  if (params.currentDepth >= params.targetDepth - 1)
    return findInsertAtDepth(params)
  return traverseChildrenForInsert(params)
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
  ignoreCollapsed?: boolean
  expandParent?: boolean
  getNodeKey: GetNodeKeyFunction
}): FullTree & TreeIndex & TreePath & { parentNode: TreeItem | null } => {
  if (!treeData && targetDepth === 0) {
    return {
      treeData: [newNode],
      treeIndex: 0,
      path: [getNodeKey({ node: newNode, treeIndex: 0 }) as number],
      parentNode: null,
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

  if (
    !('insertedTreeIndex' in insertResult) ||
    insertResult.insertedTreeIndex === undefined
  ) {
    throw new Error('No suitable position found to insert.')
  }

  const treeIndex = insertResult.insertedTreeIndex
  return {
    treeData: insertResult.node.children as TreeItem[],
    treeIndex,
    path: [
      ...(insertResult.parentPath || []),
      getNodeKey({ node: newNode, treeIndex }),
    ] as number[],
    parentNode: insertResult.parentNode ?? null,
  }
}

export const getFlatDataFromTree = ({
  treeData,
  getNodeKey,
  ignoreCollapsed = true,
}: FullTree & {
  getNodeKey: GetNodeKeyFunction
  ignoreCollapsed?: boolean
}): FlatDataItem[] => {
  if (!treeData || treeData.length === 0) {
    return []
  }

  const flattened: FlatDataItem[] = []
  walk({
    treeData,
    getNodeKey,
    ignoreCollapsed,
    callback: (nodeInfo: FlatDataItem) => {
      flattened.push(nodeInfo)
    },
  })

  return flattened
}

export const getTreeFromFlatData = <T extends Record<string, unknown>>({
  flatData,
  getKey = (node) => node['id'] as string,
  getParentKey = (node) => node['parentId'] as string,
  rootKey = '0',
}: {
  flatData: T[]
  getKey?: (node: T) => string
  getParentKey?: (node: T) => string
  rootKey?: string | null
}): T[] => {
  if (!flatData) {
    return []
  }

  const childrenToParents = Object.groupBy(flatData, (child) =>
    getParentKey(child)
  )

  if (!(String(rootKey) in childrenToParents)) {
    return []
  }

  const trav = (parent: T): T => {
    const parentKey = getKey(parent)
    const children = childrenToParents[parentKey]
    if (children) {
      return {
        ...parent,
        children: children.map((child) => trav(child)),
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

export const getDepth = (node: TreeItem, depth = 0): number => {
  if (!node.children) {
    return depth
  }

  if (typeof node.children === 'function') {
    return depth + 1
  }

  let deepest = depth
  for (const child of node.children) {
    deepest = Math.max(deepest, getDepth(child, depth + 1))
  }
  return deepest
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
  searchQuery?: string | number
  searchMethod: (data: SearchData) => boolean
  searchFocusOffset?: number
  expandAllMatchPaths?: boolean
  expandFocusMatchPaths?: boolean
}): { matches: NodeData[] } & FullTree => {
  let matchCount = 0
  const trav = ({
    isPseudoRoot = false,
    node,
    currentIndex,
    path = [],
  }: {
    isPseudoRoot?: boolean
    node: TreeItem
    currentIndex: number
    path?: Array<string | number>
  }) => {
    let matches: Array<{
      node: TreeItem
      path?: Array<string | number>
      treeIndex?: number
    }> = []
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
    if (
      !isPseudoRoot &&
      searchMethod({
        ...extraInfo,
        node,
        searchQuery: searchQuery as string,
      } as SearchData)
    ) {
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
      newNode.children = (newNode.children as TreeItem[]).map(
        (child: TreeItem) => {
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
        }
      )
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
    matches: result.matches as NodeData[],
    treeData: result.node.children as TreeItem[],
  }
}
