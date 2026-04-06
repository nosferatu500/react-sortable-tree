import React, {
  ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { DndContext, DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { VList, VListHandle } from 'virtua'
import NodeRendererDefault from './node-renderer-default'
import PlaceholderRendererDefault from './placeholder-renderer-default'
import TreeNode from './tree-node'
import TreePlaceholder from './tree-placeholder'
import { GetNodeKeyFunction, TreeItem } from './types'
import { classnames } from './utils/classnames'
import {
  defaultGetNodeKey,
  defaultSearchMethod,
} from './utils/default-handlers'
import { wrapPlaceholder, wrapSource, wrapTarget } from './utils/dnd-manager'
import { slideRows } from './utils/generic-utils'
import {
  changeNodeAtPath,
  find,
  getDescendantCount,
  getFlatDataFromTree,
  insertNode,
  removeNode,
  toggleExpandedForAll,
  walk,
} from './utils/tree-data-utils'
import './react-sortable-tree.css'

type SearchParams = {
  node: TreeItem
  path: number[]
  treeIndex: number
  searchQuery: string
}

type SearchFinishCallbackParams = {
  node: TreeItem
  path: number[]
  treeIndex: number
}[]

type GenerateNodePropsParams = {
  node: TreeItem
  path: number[]
  treeIndex: number
  lowerSiblingCounts: number[]
  isSearchMatch: boolean
  isSearchFocus: boolean
}

type ShouldCopyOnOutsideDropParams = {
  node: TreeItem
  prevPath: number[]
  prevTreeIndex: number
}

type OnMoveNodeParams = {
  treeData: TreeItem[]
  node: TreeItem
  nextParentNode: TreeItem | null
  prevPath: number[]
  prevTreeIndex: number
  nextPath?: number[]
  nextTreeIndex?: number
}

type CanDropParams = {
  node: TreeItem
  prevPath: number[]
  prevParent: TreeItem
  prevTreeIndex: number
  nextPath: number[]
  nextParent: TreeItem
  nextTreeIndex: number
}

type OnVisibilityToggleParams = {
  treeData: TreeItem[]
  node: TreeItem
  expanded: boolean
  path: number[]
}

type OnDragStateChangedParams = {
  isDragging: boolean
  draggedNode: TreeItem | undefined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRenderer = React.ComponentType<any>

type ThemeProps = {
  style?: React.CSSProperties
  innerStyle?: React.CSSProperties
  scaffoldBlockPxWidth?: number
  slideRegionSize?: number
  treeNodeRenderer?: AnyRenderer
  nodeContentRenderer?: AnyRenderer
  placeholderRenderer?: AnyRenderer
  dndType?: string
}

export type ReactSortableTreeProps = {
  children?: ReactNode
  dragDropManager?: {
    getMonitor: () => unknown
  }
  treeData: TreeItem[]
  style?: React.CSSProperties
  className?: string
  virtuaRef?: React.RefObject<VListHandle>
  innerStyle?: React.CSSProperties
  slideRegionSize?: number
  scaffoldBlockPxWidth?: number
  maxDepth?: number
  searchMethod?: (params: SearchParams) => boolean
  searchQuery?: string
  searchFocusOffset?: number
  searchFinishCallback?: (params: SearchFinishCallbackParams) => void
  generateNodeProps?: (
    params: GenerateNodePropsParams
  ) => Record<string, unknown>
  treeNodeRenderer?: AnyRenderer
  nodeContentRenderer?: AnyRenderer
  placeholderRenderer?: AnyRenderer
  theme?: ThemeProps
  rowHeight?:
    | number
    | ((treeIndex: number, node: TreeItem, path: number[]) => number)
  getNodeKey?: GetNodeKeyFunction
  onChange: (treeData: TreeItem[]) => void
  onMoveNode?: (params: OnMoveNodeParams) => void
  canDrag?: boolean | ((params: GenerateNodePropsParams) => boolean)
  canDrop?: (params: CanDropParams) => boolean
  canNodeHaveChildren?: (node: TreeItem) => boolean
  shouldCopyOnOutsideDrop?:
    | ((params: ShouldCopyOnOutsideDropParams) => boolean)
    | boolean
  onVisibilityToggle?: (params: OnVisibilityToggleParams) => void
  dndType?: string
  onDragStateChanged?: (params: OnDragStateChangedParams) => void
  onlyExpandSearchedNodes?: boolean
  rowDirection?: string
  loadCollapsedLazyChildren?: boolean
}

interface MergedTheme extends ReactSortableTreeProps {
  nodeContentRenderer: AnyRenderer
  placeholderRenderer: AnyRenderer
  scaffoldBlockPxWidth: number
  slideRegionSize: number
  rowHeight:
    | number
    | ((treeIndex: number, node: TreeItem, path: number[]) => number)
  treeNodeRenderer: AnyRenderer
}

// Helper to memoize theme merging to avoid re-renders in StrictMode/Concurrent Root
const getMergedTheme = (props: ReactSortableTreeProps): MergedTheme => {
  const merged: MergedTheme = {
    ...props,
    style: { ...props.theme?.style, ...props.style },
    innerStyle: { ...props.theme?.innerStyle, ...props.innerStyle },
    nodeContentRenderer:
      props.nodeContentRenderer ||
      props.theme?.nodeContentRenderer ||
      NodeRendererDefault,
    placeholderRenderer:
      props.placeholderRenderer ||
      props.theme?.placeholderRenderer ||
      PlaceholderRendererDefault,
    scaffoldBlockPxWidth:
      props.scaffoldBlockPxWidth ?? props.theme?.scaffoldBlockPxWidth ?? 44,
    slideRegionSize:
      props.slideRegionSize ?? props.theme?.slideRegionSize ?? 100,
    rowHeight: props.rowHeight ?? 62,
    treeNodeRenderer:
      props.treeNodeRenderer || props.theme?.treeNodeRenderer || TreeNode,
  }

  return merged
}

interface ReactSortableTreeState {
  draggingTreeData?: TreeItem[]
  draggedNode?: TreeItem
  draggedMinimumTreeIndex?: number
  draggedDepth?: number
  searchMatches: Array<{ path: number[]; treeIndex: number }>
  searchFocusTreeIndex?: number
  dragging: boolean
  treeData: TreeItem[]
  ignoreOneTreeUpdate: boolean
}

interface DropResult {
  node: TreeItem
  path: number[]
  treeIndex: number
  treeId: string
  minimumTreeIndex: number
  depth: number
}

// Static search function (extracted from class)
const performSearch = (
  props: ReactSortableTreeProps,
  treeData: TreeItem[],
  seekIndex: boolean,
  expand: boolean,
  singleSearch: boolean
): {
  searchMatches: Array<{ path: number[]; treeIndex: number }>
  searchFocusTreeIndex?: number
  newTreeData?: TreeItem[]
} => {
  const {
    onChange,
    getNodeKey,
    searchFinishCallback,
    searchQuery,
    searchMethod,
    searchFocusOffset,
    onlyExpandSearchedNodes,
  } = props

  // Skip search if no conditions are specified
  if (!searchQuery && !searchMethod) {
    if (searchFinishCallback) {
      searchFinishCallback([])
    }

    return { searchMatches: [] }
  }

  // if onlyExpandSearchedNodes collapse the tree and search
  const { treeData: expandedTreeData, matches: searchMatches } = find({
    getNodeKey: getNodeKey!,
    treeData: onlyExpandSearchedNodes
      ? toggleExpandedForAll({
          treeData,
          expanded: false,
        })
      : treeData,
    searchQuery,
    searchMethod: searchMethod || defaultSearchMethod,
    searchFocusOffset,
    expandAllMatchPaths: expand && !singleSearch,
    expandFocusMatchPaths: !!expand,
  })

  // Update the tree with data leaving all paths leading to matching nodes open
  let newTreeData: TreeItem[] | undefined
  if (expand) {
    newTreeData = expandedTreeData
    onChange(expandedTreeData)
  }

  if (searchFinishCallback) {
    searchFinishCallback(searchMatches)
  }

  let searchFocusTreeIndex: number | undefined
  if (
    seekIndex &&
    searchFocusOffset !== undefined &&
    searchFocusOffset < searchMatches.length
  ) {
    searchFocusTreeIndex = searchMatches[searchFocusOffset].treeIndex
  }

  return { searchMatches, searchFocusTreeIndex, newTreeData }
}

// Load any children in the tree that are given by a function
// calls the onChange callback on the new treeData
const loadLazyChildren = (
  props: ReactSortableTreeProps,
  treeData: TreeItem[]
) => {
  walk({
    treeData,
    getNodeKey: props.getNodeKey!,
    callback: ({
      node,
      path,
      lowerSiblingCounts,
      treeIndex,
    }: {
      node: TreeItem
      path: number[]
      lowerSiblingCounts: number[]
      treeIndex: number
    }) => {
      // If the node has children defined by a function, and is either expanded
      //  or set to load even before expansion, run the function.
      if (
        node.children &&
        typeof node.children === 'function' &&
        (node.expanded || props.loadCollapsedLazyChildren)
      ) {
        // Call the children fetching function
        ;(
          node.children as (params: {
            node: TreeItem
            path: number[]
            lowerSiblingCounts: number[]
            treeIndex: number
            done: (childrenArray: TreeItem[]) => void
          }) => void
        )({
          node,
          path,
          lowerSiblingCounts,
          treeIndex,

          // Provide a helper to append the new data when it is received
          done: (childrenArray: TreeItem[]) =>
            props.onChange(
              changeNodeAtPath({
                treeData,
                path,
                newNode: ({ node: oldNode }: { node: TreeItem }) =>
                  // Only replace the old node if it's the one we set off to find children
                  //  for in the first place
                  oldNode === node
                    ? {
                        ...oldNode,
                        children: childrenArray,
                      }
                    : oldNode,
                getNodeKey: props.getNodeKey!,
              })
            ),
        })
      }
    },
  })
}

// Default props values
const defaultProps: Partial<ReactSortableTreeProps> = {
  canDrag: true,
  canDrop: undefined,
  canNodeHaveChildren: () => true,
  className: '',
  dndType: undefined,
  generateNodeProps: undefined,
  getNodeKey: defaultGetNodeKey,
  innerStyle: {},
  maxDepth: undefined,
  treeNodeRenderer: undefined,
  nodeContentRenderer: undefined,
  onMoveNode: () => {},
  onVisibilityToggle: () => {},
  placeholderRenderer: undefined,
  scaffoldBlockPxWidth: undefined,
  searchFinishCallback: undefined,
  searchFocusOffset: undefined,
  searchMethod: undefined,
  searchQuery: undefined,
  shouldCopyOnOutsideDrop: false,
  slideRegionSize: undefined,
  style: {},
  theme: {},
  onDragStateChanged: () => {},
  onlyExpandSearchedNodes: false,
  rowDirection: 'ltr',
  virtuaRef: undefined,
}

const ReactSortableTreeInner = (props: Readonly<ReactSortableTreeProps>) => {
  // React 18: useId for stable, unique tree IDs (replaces manual counter)
  const generatedTreeId = useId()
  const treeId = `rst__${generatedTreeId}`

  // React 18: useTransition for non-blocking search operations
  const [, startSearchTransition] = useTransition()

  // Memoize merged props to avoid recreating on every render
  const mergedProps = useMemo(() => ({ ...defaultProps, ...props }), [props])

  // React 18: useDeferredValue for responsive search input
  const deferredSearchQuery = useDeferredValue(mergedProps.searchQuery)
  const deferredSearchFocusOffset = useDeferredValue(
    mergedProps.searchFocusOffset
  )

  // Refs - always call useRef unconditionally
  const internalListRef = useRef<VListHandle>(null)
  const listRef = mergedProps.virtuaRef || internalListRef
  const prevTreeDataRef = useRef<TreeItem[]>(mergedProps.treeData)
  const prevDeferredSearchQueryRef = useRef(deferredSearchQuery)
  const prevDeferredSearchFocusOffsetRef = useRef(deferredSearchFocusOffset)
  const prevDraggingRef = useRef(false)
  const isInitialMountRef = useRef(true)

  // Refs for pending callbacks (to avoid calling onChange during setState)
  const pendingOnChangeRef = useRef<TreeItem[] | null>(null)
  const pendingOnMoveNodeRef = useRef<OnMoveNodeParams | null>(null)
  const pendingOnVisibilityToggleRef = useRef<OnVisibilityToggleParams | null>(
    null
  )

  // State
  const [state, setState] = useState<ReactSortableTreeState>(() => ({
    draggingTreeData: undefined,
    draggedNode: undefined,
    draggedMinimumTreeIndex: undefined,
    draggedDepth: undefined,
    searchMatches: [],
    searchFocusTreeIndex: undefined,
    dragging: false,
    treeData: mergedProps.treeData,
    ignoreOneTreeUpdate: false,
  }))

  // Memoized theme
  const mergedTheme = useMemo(
    () => getMergedTheme(mergedProps as ReactSortableTreeProps),
    [mergedProps]
  )

  // DnD type
  const dndType = useMemo(
    () => mergedTheme.dndType || treeId,
    [mergedTheme.dndType, treeId]
  )

  // Callbacks - defined before they're used in wrapped components
  const startDrag = useCallback(
    ({ path }: { path: number[] }) => {
      setState((prevState) => {
        const result = removeNode({
          treeData: prevState.treeData,
          path,
          getNodeKey: mergedProps.getNodeKey!,
        })

        if (!result) {
          return prevState
        }

        const {
          treeData: draggingTreeData,
          node: draggedNode,
          treeIndex: draggedMinimumTreeIndex,
        } = result

        return {
          ...prevState,
          draggingTreeData,
          draggedNode,
          draggedDepth: path.length - 1,
          draggedMinimumTreeIndex,
          dragging: true,
        }
      })
    },
    [mergedProps.getNodeKey]
  )

  const moveNode = useCallback(
    ({
      node,
      path: prevPath,
      treeIndex: prevTreeIndex,
      depth,
      minimumTreeIndex,
    }: {
      node: TreeItem
      path: number[]
      treeIndex: number
      depth: number
      minimumTreeIndex: number
    }) => {
      setState((prevState) => {
        const {
          treeData,
          treeIndex,
          path,
          parentNode: nextParentNode,
        } = insertNode({
          treeData: prevState.draggingTreeData!,
          newNode: node,
          depth,
          minimumTreeIndex,
          expandParent: true,
          getNodeKey: mergedProps.getNodeKey!,
        })

        // Store callbacks in refs to be called after state update (avoids setState-during-render warning)
        pendingOnChangeRef.current = treeData
        pendingOnMoveNodeRef.current = {
          treeData,
          node,
          nextPath: path,
          nextTreeIndex: treeIndex,
          prevPath,
          prevTreeIndex,
          nextParentNode,
        }

        return {
          ...prevState,
          draggingTreeData: undefined,
          draggedNode: undefined,
          draggedMinimumTreeIndex: undefined,
          draggedDepth: undefined,
          dragging: false,
        }
      })
    },
    [mergedProps.getNodeKey]
  )

  const drop = useCallback(
    (dropResult: DropResult) => {
      moveNode(dropResult)
    },
    [moveNode]
  )

  const endDrag = useCallback(
    (dropResult: DropResult | null) => {
      // Drop was cancelled
      if (!dropResult) {
        setState((prevState) => ({
          ...prevState,
          draggingTreeData: undefined,
          draggedNode: undefined,
          draggedMinimumTreeIndex: undefined,
          draggedDepth: undefined,
          dragging: false,
        }))
      } else if (dropResult.treeId !== treeId) {
        // The node was dropped in an external drop target or tree
        setState((prevState) => {
          const { node, path, treeIndex } = dropResult
          let shouldCopy = mergedProps.shouldCopyOnOutsideDrop
          if (typeof shouldCopy === 'function') {
            shouldCopy = shouldCopy({
              node,
              prevTreeIndex: treeIndex,
              prevPath: path,
            })
          }

          let treeData = prevState.draggingTreeData || prevState.treeData

          // If copying is enabled, a drop outside leaves behind a copy in the
          //  source tree
          if (shouldCopy) {
            treeData = changeNodeAtPath({
              treeData: prevState.treeData, // use treeData unaltered by the drag operation
              path,
              newNode: ({ node: copyNode }: { node: TreeItem }) => ({
                ...copyNode,
              }), // create a shallow copy of the node
              getNodeKey: mergedProps.getNodeKey!,
            })
          }

          // Store callbacks in refs to be called after state update
          pendingOnChangeRef.current = treeData
          pendingOnMoveNodeRef.current = {
            treeData,
            node,
            nextPath: undefined,
            nextTreeIndex: undefined,
            prevPath: path,
            prevTreeIndex: treeIndex,
            nextParentNode: null,
          }

          return {
            ...prevState,
            draggingTreeData: undefined,
            draggedNode: undefined,
            draggedMinimumTreeIndex: undefined,
            draggedDepth: undefined,
            dragging: false,
          }
        })
      }
    },
    [treeId, mergedProps.shouldCopyOnOutsideDrop, mergedProps.getNodeKey]
  )

  const dragHover = useCallback(
    ({
      node: draggedNode,
      depth: draggedDepth,
      minimumTreeIndex: draggedMinimumTreeIndex,
    }: {
      node: TreeItem
      depth: number
      minimumTreeIndex: number
    }) => {
      setState((prevState) => {
        // Ignore this hover if it is at the same position as the last hover
        if (
          prevState.draggedDepth === draggedDepth &&
          prevState.draggedMinimumTreeIndex === draggedMinimumTreeIndex
        ) {
          return prevState
        }

        // Fall back to the tree data if something is being dragged in from
        //  an external element
        const newDraggingTreeData =
          prevState.draggingTreeData || prevState.treeData

        const addedResult = insertNode({
          treeData: newDraggingTreeData,
          newNode: draggedNode,
          depth: draggedDepth,
          minimumTreeIndex: draggedMinimumTreeIndex,
          expandParent: true,
          getNodeKey: mergedProps.getNodeKey!,
        })

        const rows = getFlatDataFromTree({
          ignoreCollapsed: true,
          getNodeKey: mergedProps.getNodeKey!,
          treeData: addedResult.treeData,
        })
        const expandedParentPath = rows[addedResult.treeIndex].path

        return {
          ...prevState,
          draggedNode,
          draggedDepth,
          draggedMinimumTreeIndex,
          draggingTreeData: changeNodeAtPath({
            treeData: newDraggingTreeData,
            path: expandedParentPath.toSpliced(-1),
            newNode: ({ node }: { node: TreeItem }) => ({
              ...node,
              expanded: true,
            }),
            getNodeKey: mergedProps.getNodeKey!,
          }),
          // reset the scroll focus so it doesn't jump back
          // to a search result while dragging
          searchFocusTreeIndex: undefined,
          dragging: true,
        }
      })
    },
    [mergedProps.getNodeKey]
  )

  const canNodeHaveChildren = useCallback(
    (node: TreeItem) => {
      if (mergedProps.canNodeHaveChildren) {
        return mergedProps.canNodeHaveChildren(node)
      }
      return true
    },
    [mergedProps]
  )

  const toggleChildrenVisibility = useCallback(
    ({ node: targetNode, path }: { node: TreeItem; path: number[] }) => {
      setState((prevState) => {
        const treeData = changeNodeAtPath({
          treeData: prevState.treeData,
          path,
          newNode: ({ node }: { node: TreeItem }) => ({
            ...node,
            expanded: !node.expanded,
          }),
          getNodeKey: mergedProps.getNodeKey!,
        })

        // Store callbacks in refs to be called after state update
        pendingOnChangeRef.current = treeData
        pendingOnVisibilityToggleRef.current = {
          treeData,
          node: targetNode,
          expanded: !targetNode.expanded,
          path,
        }

        // Must return new state to trigger re-render so pending callbacks effect runs
        return {
          ...prevState,
          treeData,
        }
      })
    },
    [mergedProps.getNodeKey]
  )

  // Wrapped components (memoized to avoid recreation)
  const nodeContentRenderer = useMemo(
    () =>
      wrapSource(mergedTheme.nodeContentRenderer, startDrag, endDrag, dndType),
    [mergedTheme.nodeContentRenderer, startDrag, endDrag, dndType]
  )

  const treePlaceholderRenderer = useMemo(
    () => wrapPlaceholder(TreePlaceholder, treeId, drop, dndType),
    [treeId, drop, dndType]
  )

  const treeNodeRenderer = useMemo(
    () =>
      wrapTarget(
        mergedTheme.treeNodeRenderer,
        canNodeHaveChildren,
        treeId,
        mergedProps.maxDepth,
        mergedProps.canDrop,
        drop,
        dragHover,
        dndType
      ),
    [
      mergedTheme.treeNodeRenderer,
      canNodeHaveChildren,
      treeId,
      mergedProps.maxDepth,
      mergedProps.canDrop,
      drop,
      dragHover,
      dndType,
    ]
  )

  // React 18: useMemo for tree operations (replaces custom memoization)
  const getRows = useCallback(
    (treeData: TreeItem[]) => {
      return getFlatDataFromTree({
        ignoreCollapsed: true,
        getNodeKey: mergedProps.getNodeKey!,
        treeData,
      })
    },
    [mergedProps.getNodeKey]
  )

  // Effect: Execute pending callbacks after state updates
  // This avoids the "Cannot update a component while rendering a different component" warning
  useEffect(() => {
    if (pendingOnChangeRef.current !== null) {
      const treeData = pendingOnChangeRef.current
      pendingOnChangeRef.current = null
      mergedProps.onChange(treeData)
    }

    if (pendingOnMoveNodeRef.current !== null) {
      const params = pendingOnMoveNodeRef.current
      pendingOnMoveNodeRef.current = null
      if (mergedProps.onMoveNode) {
        mergedProps.onMoveNode(params)
      }
    }

    if (pendingOnVisibilityToggleRef.current !== null) {
      const params = pendingOnVisibilityToggleRef.current
      pendingOnVisibilityToggleRef.current = null
      if (mergedProps.onVisibilityToggle) {
        mergedProps.onVisibilityToggle(params)
      }
    }
  })

  // Effect: Initial mount - load lazy children and perform initial search
  useEffect(() => {
    loadLazyChildren(
      mergedProps as ReactSortableTreeProps,
      mergedProps.treeData
    )

    startSearchTransition(() => {
      const searchResult = performSearch(
        mergedProps as ReactSortableTreeProps,
        mergedProps.treeData,
        true,
        true,
        false
      )
      setState((prev) => ({
        ...prev,
        searchMatches: searchResult.searchMatches,
        searchFocusTreeIndex: searchResult.searchFocusTreeIndex,
        ignoreOneTreeUpdate: searchResult.newTreeData
          ? true
          : prev.ignoreOneTreeUpdate,
      }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Effect: Handle tree data changes from props
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      return
    }

    const isTreeDataEqual = prevTreeDataRef.current === mergedProps.treeData
    prevTreeDataRef.current = mergedProps.treeData!

    if (!isTreeDataEqual) {
      // Check if we should ignore this update (set by search expanding nodes)
      let shouldSearch = true
      setState((prevState) => {
        if (prevState.ignoreOneTreeUpdate) {
          shouldSearch = false
          return {
            ...prevState,
            treeData: mergedProps.treeData,
            ignoreOneTreeUpdate: false,
          }
        }

        return {
          ...prevState,
          treeData: mergedProps.treeData,
          draggingTreeData: undefined,
          draggedNode: undefined,
          draggedMinimumTreeIndex: undefined,
          draggedDepth: undefined,
          dragging: false,
        }
      })

      // Perform these operations outside of setState to avoid "Cannot call startTransition while rendering"
      if (shouldSearch) {
        loadLazyChildren(
          mergedProps as ReactSortableTreeProps,
          mergedProps.treeData
        )

        startSearchTransition(() => {
          const searchResult = performSearch(
            mergedProps as ReactSortableTreeProps,
            mergedProps.treeData,
            false,
            false,
            false
          )
          setState((prev) => ({
            ...prev,
            searchMatches: searchResult.searchMatches,
            searchFocusTreeIndex: undefined,
          }))
        })
      }
    }
  }, [mergedProps.treeData, mergedProps])

  // Effect: Handle deferred search query changes (React 18: useDeferredValue)
  useEffect(() => {
    const queryChanged =
      prevDeferredSearchQueryRef.current !== deferredSearchQuery
    const offsetChanged =
      prevDeferredSearchFocusOffsetRef.current !== deferredSearchFocusOffset

    prevDeferredSearchQueryRef.current = deferredSearchQuery
    prevDeferredSearchFocusOffsetRef.current = deferredSearchFocusOffset

    if (queryChanged) {
      // React 18: useTransition for non-blocking search
      startSearchTransition(() => {
        const searchResult = performSearch(
          {
            ...(mergedProps as ReactSortableTreeProps),
            searchQuery: deferredSearchQuery,
          },
          state.treeData,
          true,
          true,
          false
        )
        setState((prev) => ({
          ...prev,
          searchMatches: searchResult.searchMatches,
          searchFocusTreeIndex: searchResult.searchFocusTreeIndex,
          ignoreOneTreeUpdate: searchResult.newTreeData
            ? true
            : prev.ignoreOneTreeUpdate,
        }))
      })
    } else if (offsetChanged) {
      startSearchTransition(() => {
        const searchResult = performSearch(
          {
            ...(mergedProps as ReactSortableTreeProps),
            searchQuery: deferredSearchQuery,
            searchFocusOffset: deferredSearchFocusOffset,
          },
          state.treeData,
          true,
          true,
          true
        )
        setState((prev) => ({
          ...prev,
          searchMatches: searchResult.searchMatches,
          searchFocusTreeIndex: searchResult.searchFocusTreeIndex,
          ignoreOneTreeUpdate: searchResult.newTreeData
            ? true
            : prev.ignoreOneTreeUpdate,
        }))
      })
    }
  }, [
    deferredSearchQuery,
    deferredSearchFocusOffset,
    mergedProps,
    state.treeData,
  ])

  // Effect: Call onDragStateChanged when dragging state changes
  useEffect(() => {
    if (prevDraggingRef.current !== state.dragging) {
      prevDraggingRef.current = state.dragging
      if (mergedProps.onDragStateChanged) {
        mergedProps.onDragStateChanged({
          isDragging: state.dragging,
          draggedNode: state.draggedNode,
        })
      }
    }
  }, [state.dragging, state.draggedNode, mergedProps])

  // Render row function
  const renderRow = useCallback(
    (
      row: {
        node: TreeItem
        parentNode: TreeItem | null
        path: number[]
        lowerSiblingCounts: number[]
        treeIndex: number
      },
      {
        listIndex,
        getPrevRow,
        matchKeys,
        swapFrom,
        swapDepth,
        swapLength,
      }: {
        listIndex: number
        getPrevRow: () =>
          | {
              node: TreeItem
              parentNode: TreeItem | null
              path: number[]
              lowerSiblingCounts: number[]
              treeIndex: number
            }
          | undefined
        matchKeys: Record<number, number>
        swapFrom: number | undefined
        swapDepth: number | undefined
        swapLength: number | undefined
      }
    ) => {
      const { node, parentNode, path, lowerSiblingCounts, treeIndex } = row

      const {
        canDrag,
        generateNodeProps,
        scaffoldBlockPxWidth,
        searchFocusOffset,
        rowDirection,
        rowHeight,
      } = mergedTheme

      const TreeNodeRenderer = treeNodeRenderer
      const NodeContentRenderer = nodeContentRenderer
      const nodeKey = path.at(-1)
      const isSearchMatch = nodeKey !== undefined && nodeKey in matchKeys
      const isSearchFocus =
        isSearchMatch && matchKeys[nodeKey] === searchFocusOffset
      const callbackParams = {
        node,
        parentNode,
        path,
        lowerSiblingCounts,
        treeIndex,
        isSearchMatch,
        isSearchFocus,
      }
      const nodeProps = generateNodeProps
        ? generateNodeProps(callbackParams as GenerateNodePropsParams)
        : {}
      const rowCanDrag =
        typeof canDrag === 'function'
          ? canDrag(callbackParams as GenerateNodePropsParams)
          : canDrag

      const sharedProps = {
        treeIndex,
        scaffoldBlockPxWidth,
        node,
        path,
        treeId,
        rowDirection,
      }

      return (
        <TreeNodeRenderer
          rowHeight={rowHeight}
          key={nodeKey}
          listIndex={listIndex}
          getPrevRow={getPrevRow}
          lowerSiblingCounts={lowerSiblingCounts}
          swapFrom={swapFrom}
          swapLength={swapLength}
          swapDepth={swapDepth}
          {...sharedProps}>
          <NodeContentRenderer
            parentNode={parentNode}
            isSearchMatch={isSearchMatch}
            isSearchFocus={isSearchFocus}
            canDrag={rowCanDrag}
            toggleChildrenVisibility={toggleChildrenVisibility}
            {...sharedProps}
            {...nodeProps}
          />
        </TreeNodeRenderer>
      )
    },
    [
      mergedTheme,
      treeNodeRenderer,
      nodeContentRenderer,
      treeId,
      toggleChildrenVisibility,
    ]
  )

  // Render
  const {
    style,
    className,
    innerStyle,
    placeholderRenderer,
    getNodeKey,
    rowDirection,
  } = mergedTheme

  const {
    searchMatches,
    searchFocusTreeIndex,
    draggedNode,
    draggedDepth,
    draggedMinimumTreeIndex,
    draggingTreeData,
    treeData: stateTreeData,
  } = state

  const treeData = draggingTreeData || stateTreeData
  const rowDirectionClass = rowDirection === 'rtl' ? 'rst__rtl' : undefined

  // React 18: useMemo for computed values (replaces custom memoization)
  const { rows, swapFrom, swapLength } = useMemo(() => {
    let computedRows
    let computedSwapFrom: number | undefined
    let computedSwapLength: number | undefined

    if (draggedNode && draggedMinimumTreeIndex !== undefined) {
      const addedResult = insertNode({
        treeData,
        newNode: draggedNode,
        depth: draggedDepth!,
        minimumTreeIndex: draggedMinimumTreeIndex,
        expandParent: true,
        getNodeKey: getNodeKey!,
      })

      const swapTo = draggedMinimumTreeIndex
      computedSwapFrom = addedResult.treeIndex
      computedSwapLength = 1 + getDescendantCount({ node: draggedNode })
      computedRows = slideRows(
        getRows(addedResult.treeData),
        computedSwapFrom,
        swapTo,
        computedSwapLength
      )
    } else {
      computedRows = getRows(treeData)
    }

    return {
      rows: computedRows,
      swapFrom: computedSwapFrom,
      swapLength: computedSwapLength,
    }
  }, [
    treeData,
    draggedNode,
    draggedDepth,
    draggedMinimumTreeIndex,
    getNodeKey,
    getRows,
  ])

  // Get indices for rows that match the search conditions
  const matchKeys = useMemo(() => {
    const keys: Record<number, number> = {}
    for (const [i, { path }] of searchMatches.entries()) {
      const lastKey = path.at(-1)
      if (lastKey !== undefined) {
        keys[lastKey] = i
      }
    }
    return keys
  }, [searchMatches])

  // Seek to the focused search result if there is one specified
  useEffect(() => {
    if (searchFocusTreeIndex !== undefined) {
      listRef?.current?.scrollToIndex(searchFocusTreeIndex, {
        smooth: true,
        align: 'center',
      })
    }
  }, [searchFocusTreeIndex, listRef])

  let containerStyle = style
  let list
  if (rows.length === 0) {
    const Placeholder = treePlaceholderRenderer
    const PlaceholderContent = placeholderRenderer
    list = (
      <Placeholder treeId={treeId} drop={drop}>
        <PlaceholderContent />
      </Placeholder>
    )
  } else {
    containerStyle = { height: '100%', ...containerStyle }

    list = (
      <VList id="vlist" ref={listRef} style={innerStyle} data={rows}>
        {(item, index) => {
          return renderRow(item, {
            listIndex: index,
            getPrevRow: () => rows[index - 1] || undefined,
            matchKeys,
            swapFrom,
            swapDepth: draggedDepth,
            swapLength,
          })
        }}
      </VList>
    )
  }

  return (
    <div
      dir={rowDirection === 'rtl' ? 'rtl' : 'ltr'}
      className={classnames(
        'rst__tree',
        className || '',
        rowDirectionClass ?? ''
      )}
      style={containerStyle}>
      {list}
    </div>
  )
}

export const SortableTreeWithoutDndContext = (
  props: ReactSortableTreeProps
) => {
  return (
    <DndContext.Consumer>
      {({ dragDropManager }) =>
        dragDropManager === undefined ? undefined : (
          <ReactSortableTreeInner
            {...props}
            dragDropManager={dragDropManager}
          />
        )
      }
    </DndContext.Consumer>
  )
}

export const SortableTree = (props: ReactSortableTreeProps) => {
  return (
    <DndProvider backend={HTML5Backend}>
      <SortableTreeWithoutDndContext {...props} />
    </DndProvider>
  )
}
