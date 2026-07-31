import type {
  FullTree,
  GetNodeKeyFunction,
  NodeData,
  SearchData,
  TreeIndex,
  TreeItem,
  TreeKey,
  TreeNode,
  TreePath,
  TreePathInput,
} from '../types'
import { cloneWithIdentity, inheritIdentity } from './node-identity'

const STOP_WALK = -Infinity

/**
 * A single row as produced by `walk` / `getFlatDataFromTree`. This mirrors
 * `WalkInfo` exactly — it is the same object, so it must declare `treeIndex`
 * too, or callers see a shape that is narrower than what they actually get.
 */
export interface FlatDataItem extends TreeNode {
  path: TreeKey[]
  lowerSiblingCounts: number[]
  treeIndex: number
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
    // Indexed rather than `for...of`/`.entries()`: both allocate per level (and
    // `.entries()` a tuple per child), which measured 5–17% slower on the
    // traversals. The skip is what a sparse `children` array would otherwise
    // crash on.
    const child = node.children[i]
    if (!child) continue
    const result = getNodeDataAtTreeIndexOrNextIndex({
      ignoreCollapsed,
      getNodeKey,
      targetIndex,
      node: child,
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

/**
 * Descendants below `node`, excluding the node itself.
 *
 * Positional rather than object arguments: this recurses once per node and is
 * itself called in loops from `findChildByKey`, `findInsertAtDepth` and
 * `addNodeUnderParent`, so an options object per call is pure allocation
 * churn — it measured ~30% on `getVisibleNodeCount` alone.
 */
const countDescendants = (node: TreeItem, ignoreCollapsed: boolean): number => {
  const { children } = node
  if (
    !children ||
    typeof children === 'function' ||
    (ignoreCollapsed && node.expanded !== true)
  ) {
    return 0
  }

  let total = 0
  for (const child of children) {
    total += 1 + countDescendants(child, ignoreCollapsed)
  }
  return total
}

/**
 * Number of descendants below `node`, excluding the node itself.
 *
 * Routing this through `getNodeDataAtTreeIndexOrNextIndex` with
 * `targetIndex: -1` also works and is what v5 did, but that builds a fresh
 * `path` and `lowerSiblingCounts` array at every level only to discard them.
 */
export const getDescendantCount = ({
  node,
  ignoreCollapsed = true,
}: TreeNode & { ignoreCollapsed?: boolean }): number =>
  countDescendants(node, ignoreCollapsed)

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
    // Indexed for the same reason as in `getNodeDataAtTreeIndexOrNextIndex`:
    // this is the flatten path, and per-child allocation shows up there.
    const child = node.children[i]
    if (!child) continue
    const result = walkDescendants({
      callback,
      getNodeKey,
      ignoreCollapsed,
      node: child,
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
  const nextNode = cloneWithIdentity(node)

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
      node: inheritIdentity(nextNode, callback(selfInfo) as TreeItem),
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
    node: inheritIdentity(nextNode, callback(selfInfo) as TreeItem),
    treeIndex: childIndex,
  }
}

export const getVisibleNodeCount = ({ treeData }: FullTree): number =>
  treeData.reduce((total, node) => total + 1 + countDescendants(node, true), 0)

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

/**
 * The child of `children` whose key is `key`, or `undefined` if there is none.
 *
 * Returns the node itself rather than just its index so callers do not have to
 * re-index the array — under `noUncheckedIndexedAccess` that read would be
 * `TreeItem | undefined` and would need an assertion to use.
 *
 * `key` may be `undefined` (a path shorter than the depth being walked). Since
 * `getNodeKey` always returns a `string` or `number`, nothing matches and the
 * caller reports the path as unresolvable, which is the correct outcome.
 */
const findChildByKey = (
  children: TreeItem[],
  key: TreeKey | undefined,
  startTreeIndex: number,
  getNodeKey: GetNodeKeyFunction,
  ignoreCollapsed: boolean
): { child: TreeItem; foundIndex: number; treeIndex: number } | undefined => {
  let treeIndex = startTreeIndex
  for (const [j, child] of children.entries()) {
    const childIndex = treeIndex + 1
    if (getNodeKey({ node: child, treeIndex: childIndex }) === key) {
      return { child, foundIndex: j, treeIndex: childIndex }
    }
    treeIndex += 1 + countDescendants(child, ignoreCollapsed)
  }
  return undefined
}

const applyNewNode = (
  children: TreeItem[],
  targetNode: TreeItem,
  foundIndex: number,
  treeIndex: number,
  newNode: NewNodeArg
): TreeItem[] => {
  const result =
    typeof newNode === 'function'
      ? newNode({ node: targetNode, treeIndex })
      : newNode

  return result === undefined || result === null
    ? children.toSpliced(foundIndex, 1)
    : // The replacement stands in for the node that was there — including when a
      // `newNode` callback built it with `{ ...node, … }` — so it keeps its row
      // identity and React updates that row instead of rebuilding it.
      children.with(foundIndex, inheritIdentity(targetNode, result))
}

/**
 * Rebuilds `siblings` with the node at `path[depthIndex...]` replaced by
 * `newNode` (or removed, if it resolves to null/undefined).
 *
 * Only the nodes along the path are cloned; every other subtree is carried over
 * by reference, so consumers keep the structural sharing they had under immer.
 */
const updateAtPath = (
  siblings: TreeItem[],
  path: TreeKey[],
  depthIndex: number,
  startTreeIndex: number,
  newNode: NewNodeArg,
  getNodeKey: GetNodeKeyFunction,
  ignoreCollapsed: boolean
): TreeItem[] => {
  const found = findChildByKey(
    siblings,
    path[depthIndex],
    startTreeIndex,
    getNodeKey,
    ignoreCollapsed
  )

  if (!found) {
    throw new Error('No node found at the given path.')
  }

  const { child, foundIndex, treeIndex } = found

  if (depthIndex === path.length - 1) {
    return applyNewNode(siblings, child, foundIndex, treeIndex, newNode)
  }

  if (!child.children || typeof child.children === 'function') {
    throw new Error('Path referenced children of node with no children.')
  }

  return siblings.with(
    foundIndex,
    cloneWithIdentity(child, {
      children: updateAtPath(
        child.children,
        path,
        depthIndex + 1,
        treeIndex,
        newNode,
        getNodeKey,
        ignoreCollapsed
      ),
    })
  )
}

export const changeNodeAtPath = ({
  treeData,
  path,
  newNode,
  getNodeKey,
  ignoreCollapsed = true,
}: FullTree &
  TreePathInput & {
    newNode: NewNodeArg
    getNodeKey: GetNodeKeyFunction
    ignoreCollapsed?: boolean
  }): TreeItem[] => {
  if (!treeData || treeData.length === 0) return []
  // An empty path addresses the pseudo-root, which has nothing to replace.
  // `dragHover` relies on this: dropping at the top level yields an empty
  // parent path, and that must be a no-op rather than an error.
  if (path.length === 0) return treeData

  return updateAtPath(
    treeData,
    path,
    0,
    -1,
    newNode,
    getNodeKey,
    ignoreCollapsed
  )
}

type TreePathParams = FullTree &
  TreePathInput & {
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
        removedNode = node
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
        foundNodeInfo = { node, treeIndex }
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

  /** Returns a copy of `node` with `newNode` added to its children. */
  const insertIntoParentNode = (
    node: TreeItem,
    nodeIndex: number
  ): TreeItem => {
    const expanded = expandParent ? { expanded: true } : undefined

    if (!node.children) {
      insertedTreeIndex = nodeIndex + 1
      return cloneWithIdentity(node, { ...expanded, children: [newNode] })
    }
    if (typeof node.children === 'function') {
      throw new TypeError('Cannot add to children defined by a function')
    }

    let childIndexOffset = nodeIndex + 1
    if (!addAsFirstChild) {
      for (const child of node.children) {
        childIndexOffset += 1 + countDescendants(child, ignoreCollapsed)
      }
    }
    insertedTreeIndex = childIndexOffset

    return cloneWithIdentity(node, {
      ...expanded,
      children: addAsFirstChild
        ? [newNode, ...node.children]
        : [...node.children, newNode],
    })
  }

  /**
   * Returns `nodes` with the parent replaced, or the same array untouched when
   * the parent is not in this branch — so unvisited subtrees keep their identity.
   */
  const findAndInsert = (
    nodes: TreeItem[],
    currentTreeIndex: number
  ): TreeItem[] => {
    let indexCounter = currentTreeIndex

    for (const [i, node] of nodes.entries()) {
      if (getNodeKey({ node, treeIndex: indexCounter }) === parentKey) {
        found = true
        return nodes.with(i, insertIntoParentNode(node, indexCounter))
      }

      const nextIndex =
        indexCounter + 1 + countDescendants(node, ignoreCollapsed)

      if (
        node.children &&
        typeof node.children !== 'function' &&
        (node.expanded || !ignoreCollapsed)
      ) {
        const newChildren = findAndInsert(node.children, indexCounter + 1)
        if (found) {
          return nodes.with(
            i,
            cloneWithIdentity(node, { children: newChildren })
          )
        }
      }

      indexCounter = nextIndex
    }

    return nodes
  }

  // `findAndInsert` sets `found` as a side effect, so it has to run first.
  // eslint-disable-next-line unicorn/no-declarations-before-early-exit
  const nextTreeData = findAndInsert(treeData, 0)
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
  const nextNode = cloneWithIdentity(node, {
    ...extraNodeProps,
    children: node.children ? [newNode, ...node.children] : [newNode],
  })
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
    childIndex += 1 + countDescendants(child, ignoreCollapsed)
  }

  if (insertIndex === undefined) {
    if (childIndex < minimumTreeIndex && !isLastChild) {
      return { node, nextIndex: childIndex }
    }
    insertedTreeIndex = childIndex
    insertIndex = children.length
  }

  const nextNode = cloneWithIdentity(node, {
    children: children.toSpliced(insertIndex, 0, newNode),
  })
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
      // Children are never the pseudo-root. Spreading `params` would otherwise
      // carry `isPseudoRoot: true` down the whole recursion, which suppresses
      // both the path segment and the parent node at every level — leaving
      // insertNode to report `path: [newKey]` and `parentNode: null` for every
      // nested insert.
      isPseudoRoot: false,
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

  const nextNode = cloneWithIdentity(node, { children: newChildren })
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
  getParentKey?: (node: T) => string | null
  rootKey?: string | null
}): T[] => {
  if (!flatData) {
    return []
  }

  const childrenToParents = Object.groupBy(flatData, (child) =>
    String(getParentKey(child))
  )

  const rootGroupKey = String(rootKey)
  const rootRows = childrenToParents[rootGroupKey]
  if (!rootRows) {
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

  return rootRows.map((child) => trav(child))
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
    const newNode = cloneWithIdentity(node)
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
