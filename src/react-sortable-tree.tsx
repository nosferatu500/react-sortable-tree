import React, {
  ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
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
import {
  GetNodeKeyFunction,
  GetTreeItemChildrenFn,
  TreeItem,
  TreeKey,
} from './types'
import { classnames } from './utils/classnames'
import {
  defaultGetNodeKey,
  defaultSearchMethod,
} from './utils/default-handlers'
import {
  type TreeDndHandlers,
  wrapPlaceholder,
  wrapSource,
  wrapTarget,
} from './utils/dnd-manager'
import { slideRows } from './utils/generic-utils'
import {
  type FlatDataItem,
  changeNodeAtPath,
  find,
  getDescendantCount,
  getFlatDataFromTree,
  insertNode,
  removeNode,
  toggleExpandedForAll,
  walk,
} from './utils/tree-data-utils'
import { useIsomorphicLayoutEffect } from './utils/use-isomorphic-layout-effect'
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

export type GenerateNodePropsParams = {
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

export type CanDropParams = {
  node: TreeItem
  prevPath: number[]
  prevParent?: TreeItem
  prevTreeIndex: number
  nextPath: number[]
  nextParent?: TreeItem
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
    number | ((treeIndex: number, node: TreeItem, path: number[]) => number)
  getNodeKey?: GetNodeKeyFunction
  onChange: (treeData: TreeItem[]) => void
  onMoveNode?: (params: OnMoveNodeParams) => void
  canDrag?: boolean | ((params: GenerateNodePropsParams) => boolean)
  canDrop?: (params: CanDropParams) => boolean
  canNodeHaveChildren?: (node: TreeItem) => boolean
  shouldCopyOnOutsideDrop?:
    ((params: ShouldCopyOnOutsideDropParams) => boolean) | boolean
  onVisibilityToggle?: (params: OnVisibilityToggleParams) => void
  dndType?: string
  onDragStateChanged?: (params: OnDragStateChangedParams) => void
  onlyExpandSearchedNodes?: boolean
  rowDirection?: string
  loadCollapsedLazyChildren?: boolean
  /**
   * Accessible name for the tree. A `role="tree"` needs one; supply this or
   * `aria-labelledby`.
   */
  'aria-label'?: string
  'aria-labelledby'?: string
  /**
   * Set to false to opt out of the built-in arrow-key navigation, for example
   * when the surrounding app binds those keys itself. ARIA roles and the roving
   * tabindex stay in place either way.
   */
  keyboardNavigation?: boolean
}

const DEFAULT_SCAFFOLD_BLOCK_PX_WIDTH = 44
const DEFAULT_ROW_HEIGHT = 62
const alwaysTrue = () => true

/** Children the node can actually reveal, as opposed to a lazy-loader function. */
const hasRevealableChildren = (node: TreeItem): boolean =>
  typeof node.children === 'function' ||
  (Array.isArray(node.children) && node.children.length > 0)

/**
 * Virtua wraps every row in a positioned div. Left as a plain `<div>` that
 * wrapper sits between `role="tree"` and `role="treeitem"` and breaks the
 * ownership the ARIA tree pattern requires, so it is marked presentational.
 */
const PresentationalItem = ({
  style,
  children,
  ref,
}: {
  style: React.CSSProperties
  children: ReactNode
  index: number
  ref?: React.Ref<HTMLDivElement>
}) => (
  <div ref={ref} role="none" style={style}>
    {children}
  </div>
)

/** Keys handled by the tree, so anything else passes through untouched. */
const NAVIGATION_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
])

/** True when the key event came from a control that needs the keystroke. */
const isFromTextEntry = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
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

type SearchConfig = Pick<
  ReactSortableTreeProps,
  | 'onChange'
  | 'searchFinishCallback'
  | 'searchQuery'
  | 'searchMethod'
  | 'searchFocusOffset'
  | 'onlyExpandSearchedNodes'
> & { getNodeKey: GetNodeKeyFunction }

const performSearch = (
  props: SearchConfig,
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
    getNodeKey,
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

type LazyChildrenConfig = Pick<
  ReactSortableTreeProps,
  'onChange' | 'loadCollapsedLazyChildren'
> & { getNodeKey: GetNodeKeyFunction }

// Load any children in the tree that are given by a function
// calls the onChange callback on the new treeData
const loadLazyChildren = (props: LazyChildrenConfig, treeData: TreeItem[]) => {
  walk({
    treeData,
    getNodeKey: props.getNodeKey,
    callback: ({ node, path, lowerSiblingCounts, treeIndex }) => {
      // If the node has children defined by a function, and is either expanded
      //  or set to load even before expansion, run the function.
      if (
        node.children &&
        typeof node.children === 'function' &&
        (node.expanded || props.loadCollapsedLazyChildren)
      ) {
        // Call the children fetching function
        ;(node.children as GetTreeItemChildrenFn)({
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

const ReactSortableTreeInner = (props: Readonly<ReactSortableTreeProps>) => {
  const {
    treeData: treeDataProp,
    onChange,
    onMoveNode,
    onVisibilityToggle,
    onDragStateChanged,
    searchFinishCallback,
    searchQuery,
    searchMethod,
    searchFocusOffset,
    onlyExpandSearchedNodes = false,
    generateNodeProps,
    getNodeKey = defaultGetNodeKey,
    canDrag = true,
    canDrop,
    canNodeHaveChildren = alwaysTrue,
    shouldCopyOnOutsideDrop = false,
    maxDepth,
    loadCollapsedLazyChildren,
    className = '',
    rowDirection = 'ltr',
    virtuaRef,
    theme,
    style: styleProp,
    innerStyle: innerStyleProp,
    scaffoldBlockPxWidth: scaffoldBlockPxWidthProp,
    rowHeight = DEFAULT_ROW_HEIGHT,
    nodeContentRenderer: nodeContentRendererProp,
    placeholderRenderer: placeholderRendererProp,
    treeNodeRenderer: treeNodeRendererProp,
    dndType: dndTypeProp,
    keyboardNavigation = true,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  } = props

  // Theme fallbacks. These are plain expressions rather than a memoized merged
  // object: a merged object would be a fresh reference on every render, and
  // anything memoized against it — including the wrapped DnD components — would
  // rebuild along with it.
  const NodeContent: AnyRenderer =
    nodeContentRendererProp ?? theme?.nodeContentRenderer ?? NodeRendererDefault
  const PlaceholderContent: AnyRenderer =
    placeholderRendererProp ??
    theme?.placeholderRenderer ??
    PlaceholderRendererDefault
  const TreeNodeRendererBase: AnyRenderer =
    treeNodeRendererProp ?? theme?.treeNodeRenderer ?? TreeNode
  const scaffoldBlockPxWidth =
    scaffoldBlockPxWidthProp ??
    theme?.scaffoldBlockPxWidth ??
    DEFAULT_SCAFFOLD_BLOCK_PX_WIDTH

  const themeStyle = theme?.style
  const themeInnerStyle = theme?.innerStyle
  const style = useMemo(
    () => ({ ...themeStyle, ...styleProp }),
    [themeStyle, styleProp]
  )
  const innerStyle = useMemo(
    () => ({ ...themeInnerStyle, ...innerStyleProp }),
    [themeInnerStyle, innerStyleProp]
  )

  // Stable, unique tree id
  const generatedTreeId = useId()
  const treeId = `rst__${generatedTreeId}`
  const dndType = dndTypeProp ?? theme?.dndType ?? treeId

  // Non-blocking search
  const [, startSearchTransition] = useTransition()
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const deferredSearchFocusOffset = useDeferredValue(searchFocusOffset)

  // Refs
  const internalListRef = useRef<VListHandle>(null)
  const listRef = virtuaRef ?? internalListRef
  const prevTreeDataRef = useRef<TreeItem[]>(treeDataProp)
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
    treeData: treeDataProp,
    ignoreOneTreeUpdate: false,
  }))

  /**
   * Latest props read by event-time code (state updaters, DnD callbacks).
   *
   * Going through a ref is what lets the callbacks below be declared with empty
   * dependency lists. That in turn keeps `wrapSource`/`wrapTarget` memoized on
   * stable values only — otherwise each render produces new component *types*
   * and React unmounts and remounts every row.
   */
  const latestRef = useRef({ getNodeKey, shouldCopyOnOutsideDrop })
  useIsomorphicLayoutEffect(() => {
    latestRef.current = { getNodeKey, shouldCopyOnOutsideDrop }
  })

  const startDrag = useCallback(({ path }: { path: number[] }) => {
    setState((prevState) => {
      const result = removeNode({
        treeData: prevState.treeData,
        path,
        getNodeKey: latestRef.current.getNodeKey,
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
  }, [])

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
          getNodeKey: latestRef.current.getNodeKey,
        })

        // Deferred to an effect so the callbacks never fire mid-update
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
          treeData,
          draggingTreeData: undefined,
          draggedNode: undefined,
          draggedMinimumTreeIndex: undefined,
          draggedDepth: undefined,
          dragging: false,
        }
      })
    },
    []
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
          const {
            getNodeKey: currentGetNodeKey,
            shouldCopyOnOutsideDrop: copy,
          } = latestRef.current
          const shouldCopy =
            typeof copy === 'function'
              ? copy({ node, prevTreeIndex: treeIndex, prevPath: path })
              : copy

          // If copying is enabled, a drop outside leaves behind a copy in the
          //  source tree
          const treeData = shouldCopy
            ? changeNodeAtPath({
                treeData: prevState.treeData, // use treeData unaltered by the drag operation
                path,
                newNode: ({ node: copyNode }: { node: TreeItem }) => ({
                  ...copyNode,
                }), // create a shallow copy of the node
                getNodeKey: currentGetNodeKey,
              })
            : prevState.draggingTreeData || prevState.treeData

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
            treeData,
            draggingTreeData: undefined,
            draggedNode: undefined,
            draggedMinimumTreeIndex: undefined,
            draggedDepth: undefined,
            dragging: false,
          }
        })
      }
    },
    [treeId]
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

        const currentGetNodeKey = latestRef.current.getNodeKey

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
          getNodeKey: currentGetNodeKey,
        })

        // `insertNode` already knows where it put the node, so take the path
        // from there. This used to re-flatten the entire tree just to read
        // `rows[addedResult.treeIndex].path` — a full traversal on every
        // mousemove. (Only viable since insertNode stopped reporting a bogus
        // single-segment path for nested inserts.)
        const expandedParentPath = addedResult.path

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
            getNodeKey: currentGetNodeKey,
          }),
          // reset the scroll focus so it doesn't jump back
          // to a search result while dragging
          searchFocusTreeIndex: undefined,
          dragging: true,
        }
      })
    },
    []
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
          getNodeKey: latestRef.current.getNodeKey,
        })

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
    []
  )

  /**
   * Handed to the wrapped DnD components as one stable object.
   *
   * Seeded with the first render's values so the wrapped components are usable
   * before any effect has run, then refreshed in a layout effect — which lands
   * before any pointer event can reach them.
   */
  const dndHandlersRef = useRef<TreeDndHandlers>({
    canNodeHaveChildren,
    canDrop,
    maxDepth,
    startDrag,
    endDrag,
    drop,
    dragHover,
  })
  useIsomorphicLayoutEffect(() => {
    dndHandlersRef.current = {
      canNodeHaveChildren,
      canDrop,
      maxDepth,
      startDrag,
      endDrag,
      drop,
      dragHover,
    }
  })
  const getDndHandlers = useCallback(() => dndHandlersRef.current, [])

  /*
   * Wrapped components. Memoized on the renderer, tree id and dnd type only —
   * every other input reaches them through `getDndHandlers`, so their component
   * identity survives a parent re-render and rows are updated, not remounted.
   *
   * `react-hooks/refs` flags these because `getDndHandlers` reads a ref and is
   * passed to a function during render. The lint cannot see that the wrappers
   * only *store* it and call it from drag events; nothing here reads the ref
   * while rendering. Covered by the render-stability and drag-and-drop tests.
   */
  /* eslint-disable react-hooks/refs */
  const nodeContentRenderer = useMemo(
    () => wrapSource(NodeContent, dndType, getDndHandlers),
    [NodeContent, dndType, getDndHandlers]
  )

  const treePlaceholderRenderer = useMemo(
    () => wrapPlaceholder(TreePlaceholder, treeId, dndType, getDndHandlers),
    [treeId, dndType, getDndHandlers]
  )

  const treeNodeRenderer = useMemo(
    () => wrapTarget(TreeNodeRendererBase, treeId, dndType, getDndHandlers),
    [TreeNodeRendererBase, treeId, dndType, getDndHandlers]
  )
  /* eslint-enable react-hooks/refs */

  const getRows = useCallback(
    (rowTreeData: TreeItem[]) =>
      getFlatDataFromTree({
        ignoreCollapsed: true,
        getNodeKey,
        treeData: rowTreeData,
      }),
    [getNodeKey]
  )

  // Effect events: user callbacks invoked from effects. Wrapping them keeps
  // them out of dependency arrays, so the effects below re-run when their real
  // inputs change rather than on every render.
  const emitChange = useEffectEvent((next: TreeItem[]) => onChange(next))
  const emitMoveNode = useEffectEvent((params: OnMoveNodeParams) =>
    onMoveNode?.(params)
  )
  const emitVisibilityToggle = useEffectEvent(
    (params: OnVisibilityToggleParams) => onVisibilityToggle?.(params)
  )
  const emitDragStateChanged = useEffectEvent(
    (params: OnDragStateChangedParams) => onDragStateChanged?.(params)
  )

  const runSearch = useEffectEvent(
    (
      searchTreeData: TreeItem[],
      query: string | undefined,
      focusOffset: number | undefined,
      seekIndex: boolean,
      expand: boolean,
      singleSearch: boolean
    ) =>
      performSearch(
        {
          onChange,
          getNodeKey,
          searchFinishCallback,
          searchQuery: query,
          searchMethod,
          searchFocusOffset: focusOffset,
          onlyExpandSearchedNodes,
        },
        searchTreeData,
        seekIndex,
        expand,
        singleSearch
      )
  )

  const runLoadLazyChildren = useEffectEvent((lazyTreeData: TreeItem[]) =>
    loadLazyChildren(
      { onChange, getNodeKey, loadCollapsedLazyChildren },
      lazyTreeData
    )
  )

  // Effect: Execute pending callbacks after state updates
  // This avoids the "Cannot update a component while rendering a different component" warning
  useEffect(() => {
    if (pendingOnChangeRef.current !== null) {
      const nextTreeData = pendingOnChangeRef.current
      pendingOnChangeRef.current = null
      emitChange(nextTreeData)
    }

    if (pendingOnMoveNodeRef.current !== null) {
      const params = pendingOnMoveNodeRef.current
      pendingOnMoveNodeRef.current = null
      emitMoveNode(params)
    }

    if (pendingOnVisibilityToggleRef.current !== null) {
      const params = pendingOnVisibilityToggleRef.current
      pendingOnVisibilityToggleRef.current = null
      emitVisibilityToggle(params)
    }
  })

  // Effect: Initial mount - load lazy children and perform initial search
  useEffect(() => {
    runLoadLazyChildren(treeDataProp)

    startSearchTransition(() => {
      const searchResult = runSearch(
        treeDataProp,
        searchQuery,
        searchFocusOffset,
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

    if (prevTreeDataRef.current === treeDataProp) {
      return
    }
    prevTreeDataRef.current = treeDataProp

    // Check if we should ignore this update (set by search expanding nodes)
    let shouldSearch = true
    setState((prevState) => {
      if (prevState.ignoreOneTreeUpdate) {
        shouldSearch = false
        return {
          ...prevState,
          treeData: treeDataProp,
          ignoreOneTreeUpdate: false,
        }
      }

      return {
        ...prevState,
        treeData: treeDataProp,
        draggingTreeData: undefined,
        draggedNode: undefined,
        draggedMinimumTreeIndex: undefined,
        draggedDepth: undefined,
        dragging: false,
      }
    })

    // Outside of setState to avoid "Cannot call startTransition while rendering"
    if (shouldSearch) {
      runLoadLazyChildren(treeDataProp)

      startSearchTransition(() => {
        const searchResult = runSearch(
          treeDataProp,
          searchQuery,
          searchFocusOffset,
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
  }, [treeDataProp, searchQuery, searchFocusOffset])

  // Effect: Handle deferred search query changes
  useEffect(() => {
    const queryChanged =
      prevDeferredSearchQueryRef.current !== deferredSearchQuery
    const offsetChanged =
      prevDeferredSearchFocusOffsetRef.current !== deferredSearchFocusOffset

    prevDeferredSearchQueryRef.current = deferredSearchQuery
    prevDeferredSearchFocusOffsetRef.current = deferredSearchFocusOffset

    if (!queryChanged && !offsetChanged) {
      return
    }

    startSearchTransition(() => {
      const searchResult = runSearch(
        state.treeData,
        deferredSearchQuery,
        deferredSearchFocusOffset,
        true,
        true,
        // A changed focus offset alone steps through existing matches rather
        // than re-running the whole search.
        !queryChanged
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
  }, [deferredSearchQuery, deferredSearchFocusOffset, state.treeData])

  // Effect: Call onDragStateChanged when dragging state changes
  useEffect(() => {
    if (prevDraggingRef.current === state.dragging) {
      return
    }

    prevDraggingRef.current = state.dragging
    emitDragStateChanged({
      isDragging: state.dragging,
      draggedNode: state.draggedNode,
    })
  }, [state.dragging, state.draggedNode])

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
  // `aria-setsize` for depth-1 rows, which have no parentNode to count.
  const rootNodeCount = treeData.length

  const { rows, swapFrom, swapLength } = useMemo(() => {
    if (draggedNode && draggedMinimumTreeIndex !== undefined) {
      const addedResult = insertNode({
        treeData,
        newNode: draggedNode,
        depth: draggedDepth!,
        minimumTreeIndex: draggedMinimumTreeIndex,
        expandParent: true,
        getNodeKey,
      })

      const computedSwapFrom = addedResult.treeIndex
      const computedSwapLength = 1 + getDescendantCount({ node: draggedNode })
      return {
        rows: slideRows(
          getRows(addedResult.treeData),
          computedSwapFrom,
          draggedMinimumTreeIndex,
          computedSwapLength
        ),
        swapFrom: computedSwapFrom,
        swapLength: computedSwapLength,
      }
    }

    return {
      rows: getRows(treeData),
      swapFrom: undefined,
      swapLength: undefined,
    }
  }, [
    treeData,
    draggedNode,
    draggedDepth,
    draggedMinimumTreeIndex,
    getNodeKey,
    getRows,
  ])

  /* ------------------------------------------------------------------ *
   * Keyboard navigation (WAI-ARIA tree pattern)
   *
   * One row at a time is tabbable — a roving tabindex — and the arrow keys
   * move that focus. `focusedRowIndex` is an index into `rows`, so it tracks
   * the visible order rather than the tree structure.
   *
   * These are plain functions, not `useEffectEvent`: effect events may not be
   * passed as props, and these are attached to the container element. They are
   * only ever handed to a DOM node, so a fresh identity per render costs
   * nothing.
   * ------------------------------------------------------------------ */
  const containerRef = useRef<HTMLDivElement>(null)
  const [focusedRowIndex, setFocusedRowIndex] = useState(0)
  // Set when navigation should move DOM focus, cleared once it lands. Focus
  // cannot be applied immediately to a row virtua has not mounted yet.
  const pendingFocusRef = useRef<number | undefined>(undefined)

  const activeRowIndex = Math.min(focusedRowIndex, Math.max(rows.length - 1, 0))

  const focusRow = (index: number) => {
    if (rows.length === 0) return
    const clamped = Math.max(0, Math.min(index, rows.length - 1))
    setFocusedRowIndex(clamped)
    pendingFocusRef.current = clamped
    listRef.current?.scrollToIndex(clamped, { align: 'nearest' })
  }

  // Runs after every render so a row scrolled into view can still be focused.
  useEffect(() => {
    const target = pendingFocusRef.current
    if (target === undefined) return
    const element = containerRef.current?.querySelector<HTMLElement>(
      `[data-rst-row="${CSS.escape(String(target))}"]`
    )
    if (element) {
      pendingFocusRef.current = undefined
      element.focus()
    }
  })

  /**
   * Keeps the roving tabindex aligned with wherever focus actually went —
   * clicking a row, tabbing in, or a consumer calling `.focus()` — so the arrow
   * keys always act on the row the user is really on.
   */
  const handleFocus = (event: React.FocusEvent) => {
    const rowElement =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>('[data-rst-row]')
        : null
    const index = Number(rowElement?.dataset['rstRow'])
    if (Number.isSafeInteger(index)) {
      setFocusedRowIndex(index)
    }
  }

  const toggleRow = (row: FlatDataItem) =>
    toggleChildrenVisibility({ node: row.node, path: row.path as number[] })

  /** ArrowRight in ltr: open a closed node, else step into its first child. */
  const expandOrEnter = (index: number, row: FlatDataItem) => {
    if (!hasRevealableChildren(row.node)) return
    if (row.node.expanded === true) {
      focusRow(index + 1)
    } else {
      toggleRow(row)
    }
  }

  /** ArrowLeft in ltr: close an open node, else move up to its parent. */
  const collapseOrLeave = (index: number, row: FlatDataItem) => {
    if (hasRevealableChildren(row.node) && row.node.expanded === true) {
      toggleRow(row)
      return
    }
    const depth = row.path.length
    for (let i = index - 1; i >= 0; i--) {
      if (rows[i].path.length < depth) {
        focusRow(i)
        return
      }
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!keyboardNavigation || rows.length === 0) return
    if (isFromTextEntry(event.target)) return

    const { key } = event
    const isToggleKey = key === 'Enter' || key === ' '
    if (!NAVIGATION_KEYS.has(key) && !isToggleKey) return

    const index = Math.min(activeRowIndex, rows.length - 1)
    const row = rows[index]
    // Right means "deeper" in ltr and "shallower" in rtl.
    const deeper = rowDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight'

    switch (key) {
      case 'ArrowDown': {
        focusRow(index + 1)
        break
      }
      case 'ArrowUp': {
        focusRow(index - 1)
        break
      }
      case 'Home': {
        focusRow(0)
        break
      }
      case 'End': {
        focusRow(rows.length - 1)
        break
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        if (key === deeper) {
          expandOrEnter(index, row)
        } else {
          collapseOrLeave(index, row)
        }
        break
      }
      default: {
        // Enter or Space
        if (hasRevealableChildren(row.node)) toggleRow(row)
      }
    }

    // Only keys handled above reach this point, so nothing else is swallowed.
    event.preventDefault()
  }
  // Get indices for rows that match the search conditions
  const matchKeys = useMemo(() => {
    const keys: Record<TreeKey, number> = {}
    for (const [i, { path }] of searchMatches.entries()) {
      const lastKey = path.at(-1)
      if (lastKey !== undefined) {
        keys[lastKey] = i
      }
    }
    return keys
  }, [searchMatches])

  // Render row function
  const renderRow = useCallback(
    (
      row: FlatDataItem,
      {
        listIndex,
        getPrevRow,
        swapFrom: rowSwapFrom,
        swapDepth,
        swapLength: rowSwapLength,
      }: {
        listIndex: number
        getPrevRow: () => FlatDataItem | undefined
        swapFrom: number | undefined
        swapDepth: number | undefined
        swapLength: number | undefined
      }
    ) => {
      const { node, parentNode, path, lowerSiblingCounts, treeIndex } = row

      const TreeNodeRenderer = treeNodeRenderer
      const NodeContentRenderer = nodeContentRenderer
      const nodeKey = path.at(-1)
      const isSearchMatch =
        nodeKey !== undefined && Object.hasOwn(matchKeys, nodeKey)
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

      // ARIA tree semantics. The DOM is flat because the list is virtualized,
      // so depth and sibling position have to be stated explicitly rather than
      // inferred from nesting.
      const siblingCount = Array.isArray(parentNode?.children)
        ? parentNode.children.length
        : rootNodeCount
      const lowerSiblings = lowerSiblingCounts.at(-1) ?? 0

      return (
        <TreeNodeRenderer
          rowHeight={rowHeight}
          key={nodeKey}
          listIndex={listIndex}
          getPrevRow={getPrevRow}
          lowerSiblingCounts={lowerSiblingCounts}
          swapFrom={rowSwapFrom}
          swapLength={rowSwapLength}
          swapDepth={swapDepth}
          role="treeitem"
          aria-level={path.length}
          aria-setsize={siblingCount}
          aria-posinset={siblingCount - lowerSiblings}
          aria-expanded={
            hasRevealableChildren(node) ? node.expanded === true : undefined
          }
          tabIndex={listIndex === activeRowIndex ? 0 : -1}
          data-rst-row={listIndex}
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
      treeNodeRenderer,
      nodeContentRenderer,
      matchKeys,
      searchFocusOffset,
      generateNodeProps,
      canDrag,
      scaffoldBlockPxWidth,
      treeId,
      rowDirection,
      rowHeight,
      toggleChildrenVisibility,
      activeRowIndex,
      rootNodeCount,
    ]
  )

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
    list = (
      // eslint-disable-next-line react-hooks/static-components
      <Placeholder treeId={treeId} drop={drop}>
        <PlaceholderContent />
      </Placeholder>
    )
  } else {
    containerStyle = { height: '100%', ...containerStyle }

    list = (
      <VList
        id="vlist"
        // Scroll container and per-row wrappers both sit between the tree and
        // its treeitems; neither may appear in the accessibility tree.
        role="none"
        ref={listRef}
        style={innerStyle}
        data={rows}
        item={PresentationalItem}>
        {(item, index) =>
          renderRow(item, {
            listIndex: index,
            getPrevRow: () => rows[index - 1] || undefined,
            swapFrom,
            swapDepth: draggedDepth,
            swapLength,
          })
        }
      </VList>
    )
  }

  return (
    <div
      ref={containerRef}
      // The scroll container sits between this element and the rows, so the
      // tree role goes here and the intervening elements are presentational.
      role="tree"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      // The tab stop is the active row, per the roving-tabindex half of the
      // ARIA tree pattern; -1 keeps the container programmatically focusable
      // without adding a second stop.
      tabIndex={-1}
      dir={rowDirection === 'rtl' ? 'rtl' : 'ltr'}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
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
