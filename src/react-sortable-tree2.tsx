import React, { useEffect, useRef, useState } from 'react'
import withScrolling, {
  createHorizontalStrength,
  createVerticalStrength,
} from '@nosferatu500/react-dnd-scrollzone'
import { DndContext, DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import './react-sortable-tree.css'
import TreePlaceholder from './tree-placeholder'
import { mergeTheme } from './utils'
import { classnames } from './utils/classnames'
import {
  defaultGetNodeKey,
  defaultSearchMethod,
} from './utils/default-handlers'
import { wrapPlaceholder, wrapSource, wrapTarget } from './utils/dnd-manager'
import { slideRows } from './utils/generic-utils'
import {
  memoizedGetDescendantCount,
  memoizedGetFlatDataFromTree,
  memoizedInsertNode,
} from './utils/memoized-tree-data-utils'
import {
  changeNodeAtPath,
  find,
  insertNode,
  removeNode,
  toggleExpandedForAll,
  walk,
} from './utils/tree-data-utils'

let treeIdCounter = 1

// The ResizeObserver cannot deliver all observations in one animation frame.
// The author of the `ResizeObserver` spec assures that it can be safely ignored:
// https://stackoverflow.com/questions/49384120/resizeobserver-loop-limit-exceeded#comment86691361_49384120
// const ignoreResizeObserverErrors = (e: any) => {
//   const RESIZE_OBSERVER_ERRORS = [
//     'ResizeObserver loop completed with undelivered notifications.',
//     'ResizeObserver loop limit exceeded',
//   ]
//   console.log(e.message)
//   if (RESIZE_OBSERVER_ERRORS.includes(e.message)) {
//     console.log('here2')
//     e.stopImmediatePropagation()
//   }
// }

const defaultProps = {
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
  debugMode: false,
  overscan: 0,
}

const ReactSortableTree = (props: any) => {
  const [draggingTreeData, setDraggingTreeData] = useState<any>()
  const [draggedNode, setDraggedNode] = useState<any>()
  const [draggedMinimumTreeIndex, setDraggedMinimumTreeIndex] = useState<any>()
  const [draggedDepth, setDraggedDepth] = useState<any>()
  const [searchMatches, setSearchMatches] = useState<any[]>([])
  const [searchFocusTreeIndex, setSearchFocusTreeIndex] = useState<number>()
  const [dragging, setDragging] = useState<boolean>(false)

  props = { ...defaultProps, ...props }

  const listRef = useRef<VirtuosoHandle>()

  const treeId = `rst__${treeIdCounter}`
  treeIdCounter += 1

  const {
    dndType: dndTypeTheme,
    nodeContentRenderer: nodeContentRendererTheme,
    treeNodeRenderer: treeNodeRendererTheme,
    slideRegionSize,
  } = mergeTheme(props)

  const dndType = dndTypeTheme || treeId

  const startDrag = ({ path }: any) => {
    const { treeData, node, treeIndex } = removeNode({
      treeData: props.treeData,
      path,
      getNodeKey: props.getNodeKey,
    })

    setDraggingTreeData(treeData)
    setDraggedNode(node)
    setDraggedDepth(path.length - 1)
    setDraggedMinimumTreeIndex(treeIndex)
    setDragging(true)
  }

  const endDrag = (dropResult?: any) => {
    // Drop was cancelled
    if (!dropResult) {
      setDraggingTreeData(undefined)
      setDraggedNode(undefined)
      setDraggedMinimumTreeIndex(undefined)
      setDraggedDepth(undefined)
      setDragging(false)
    } else if (dropResult.treeId !== treeId) {
      // The node was dropped in an external drop target or tree
      const { node, path, treeIndex } = dropResult

      let shouldCopy = props.shouldCopyOnOutsideDrop

      if (typeof shouldCopy === 'function') {
        shouldCopy = shouldCopy({
          node,
          prevTreeIndex: treeIndex,
          prevPath: path,
        })
      }

      let treeData = draggingTreeData || props.treeData

      // If copying is enabled, a drop outside leaves behind a copy in the
      //  source tree
      if (shouldCopy) {
        treeData = changeNodeAtPath({
          treeData: props.treeData, // use treeData unaltered by the drag operation
          path,
          newNode: ({ node: copyNode }) => ({ ...copyNode }), // create a shallow copy of the node
          getNodeKey: props.getNodeKey,
        })
      }

      props.onChange(treeData)

      props.onMoveNode({
        treeData,
        node,
        treeIndex: undefined,
        path: undefined,
        nextPath: undefined,
        nextTreeIndex: undefined,
        prevPath: path,
        prevTreeIndex: treeIndex,
      })
    }
  }

  const NodeContentRenderer = wrapSource(
    nodeContentRendererTheme,
    startDrag,
    endDrag,
    dndType
  )

  const Placeholder = wrapPlaceholder(TreePlaceholder, treeId, drop, dndType)

  const ScrollZoneVirtualList = withScrolling(
    React.forwardRef((localProps, ref) => {
      const { dragDropManager, rowHeight, listRef, ...otherProps } = localProps

      // useEffect(() => {
      //   window.addEventListener('error', ignoreResizeObserverErrors)
      //   return () =>
      //     window.removeEventListener('error', ignoreResizeObserverErrors)
      // }, [])

      return <Virtuoso ref={listRef} {...otherProps} />
    })
  )

  const vStrength = createVerticalStrength(slideRegionSize)
  const hStrength = createHorizontalStrength(slideRegionSize)

  const canNodeHaveChildren = (node: any) => {
    if (props.canNodeHaveChildren) {
      return props.canNodeHaveChildren(node)
    }
    return true
  }

  const moveNode = ({
    node,
    path: prevPath,
    treeIndex: prevTreeIndex,
    depth,
    minimumTreeIndex,
  }) => {
    const {
      treeData,
      treeIndex,
      path,
      parentNode: nextParentNode,
    } = insertNode({
      treeData: draggingTreeData,
      newNode: node,
      depth,
      minimumTreeIndex,
      expandParent: true,
      getNodeKey: props.getNodeKey,
    })

    props.onChange(treeData)

    props.onMoveNode({
      treeData,
      node,
      treeIndex,
      path,
      nextPath: path,
      nextTreeIndex: treeIndex,
      prevPath,
      prevTreeIndex,
      nextParentNode,
    })
  }

  const drop = (dropResult: any) => {
    moveNode(dropResult)
  }

  const dragHover = ({ node, depth, minimumTreeIndex }) => {
    // Ignore this hover if it is at the same position as the last hover
    if (
      draggedDepth === depth &&
      draggedMinimumTreeIndex === minimumTreeIndex
    ) {
      return
    }

    // Fall back to the tree data if something is being dragged in from
    //  an external element
    const newDraggingTreeData = draggingTreeData || props.treeData

    const addedResult = memoizedInsertNode({
      treeData: newDraggingTreeData,
      newNode: node,
      depth,
      minimumTreeIndex,
      expandParent: true,
      getNodeKey: props.getNodeKey,
    })

    const rows = getRows(addedResult.treeData)
    const expandedParentPath = rows[addedResult.treeIndex].path

    setDraggedNode(node)
    setDraggedDepth(depth)
    setDraggedMinimumTreeIndex(minimumTreeIndex)
    setDraggingTreeData(
      changeNodeAtPath({
        treeData: newDraggingTreeData,
        path: expandedParentPath.slice(0, -1),
        newNode: ({ node }) => ({ ...node, expanded: true }),
        getNodeKey: props.getNodeKey,
      })
    )
    // reset the scroll focus so it doesn't jump back
    // to a search result while dragging
    setSearchFocusTreeIndex(undefined)
    setDragging(true)
  }

  const TreeNodeRenderer = wrapTarget(
    treeNodeRendererTheme,
    canNodeHaveChildren,
    treeId,
    props.maxDepth,
    props.canDrop,
    drop,
    dragHover,
    dndType
  )

  // returns the new state after search
  const search = (seekIndex, expand, singleSearch) => {
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

    const newState = { instanceProps: {} }

    // if onlyExpandSearchedNodes collapse the tree and search
    const { treeData: expandedTreeData, matches } = find({
      getNodeKey,
      treeData: onlyExpandSearchedNodes
        ? toggleExpandedForAll({
            treeData: props.treeData,
            expanded: false,
          })
        : props.treeData,
      searchQuery,
      searchMethod: searchMethod || defaultSearchMethod,
      searchFocusOffset,
      expandAllMatchPaths: expand && !singleSearch,
      expandFocusMatchPaths: !!expand,
    })

    // Update the tree with data leaving all paths leading to matching nodes open
    if (expand) {
      newState.instanceProps.ignoreOneTreeUpdate = true // Prevents infinite loop
      onChange(expandedTreeData)
    }

    if (searchFinishCallback) {
      searchFinishCallback(matches)
    }

    let searchFocusTreeIndex
    if (
      seekIndex &&
      searchFocusOffset !== undefined &&
      searchFocusOffset < matches.length
    ) {
      searchFocusTreeIndex = matches[searchFocusOffset].treeIndex
    }

    newState.searchMatches = matches
    newState.searchFocusTreeIndex = searchFocusTreeIndex

    return newState
  }

  // Load any children in the tree that are given by a function
  // calls the onChange callback on the new treeData
  const loadLazyChildren = () => {
    walk({
      treeData: props.treeData,
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
          node.children({
            node,
            path,
            lowerSiblingCounts,
            treeIndex,

            // Provide a helper to append the new data when it is received
            done: (childrenArray) =>
              props.onChange(
                changeNodeAtPath({
                  treeData: props.treeData,
                  path,
                  newNode: ({ node: oldNode }) =>
                    // Only replace the old node if it's the one we set off to find children
                    //  for in the first place
                    oldNode === node
                      ? {
                          ...oldNode,
                          children: childrenArray,
                        }
                      : oldNode,
                  getNodeKey: props.getNodeKey,
                })
              ),
          })
        }
      },
    })
  }

  const handleDndMonitorChange = () => {
    const monitor = props.dragDropManager.getMonitor()
    // If the drag ends and the tree is still in a mid-drag state,
    // it means that the drag was canceled or the dragSource dropped
    // elsewhere, and we should reset the state of this tree
    if (!monitor.isDragging() && draggingTreeData) {
      setTimeout(() => {
        endDrag()
      })
    }
  }

  useEffect(() => {
    loadLazyChildren()
    // const stateUpdate = search(true, true, false)
    // console.log({ stateUpdate })
    // setSearchMatches(stateUpdate.searchMatches)
    // setSearchFocusTreeIndex(stateUpdate.searchFocusTreeIndex)

    // Hook into react-dnd state changes to detect when the drag ends
    // TODO: This is very brittle, so it needs to be replaced if react-dnd
    // offers a more official way to detect when a drag ends
    const clearMonitorSubscription = props.dragDropManager
      .getMonitor()
      .subscribeToStateChange(handleDndMonitorChange)

    return () => {
      clearMonitorSubscription()
    }
  }, [])

  // listen to dragging
  useEffect(() => {
    // if it is not the same then call the onDragStateChanged
    if (props.onDragStateChanged) {
      props.onDragStateChanged({
        isDragging: dragging,
        draggedNode,
      })
    }
  }, [dragging])

  const getRows = (treeData: any) => {
    return memoizedGetFlatDataFromTree({
      ignoreCollapsed: true,
      getNodeKey: props.getNodeKey,
      treeData,
    })
  }

  const toggleChildrenVisibility = ({ path }) => {
    const treeData = changeNodeAtPath({
      treeData: props.treeData,
      path,
      newNode: ({ node }) => ({ ...node, expanded: !node.expanded }),
      getNodeKey: props.getNodeKey,
    })

    props.onChange(treeData)
  }

  const renderRow = (
    row,
    { listIndex, style, getPrevRow, matchKeys, swapFrom, swapDepth, swapLength }
  ) => {
    const { node, parentNode, path, lowerSiblingCounts, treeIndex } = row

    const {
      canDrag,
      generateNodeProps,
      scaffoldBlockPxWidth,
      searchFocusOffset,
      rowHeight,
    } = mergeTheme(props)
    const nodeKey = path[path.length - 1]
    const isSearchMatch = nodeKey in matchKeys
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
    const nodeProps = !generateNodeProps
      ? {}
      : generateNodeProps(callbackParams)
    const rowCanDrag =
      typeof canDrag !== 'function' ? canDrag : canDrag(callbackParams)

    const sharedProps = {
      treeIndex,
      scaffoldBlockPxWidth,
      node,
      path,
      treeId,
    }

    return (
      <TreeNodeRenderer
        style={style}
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
  }

  const {
    dragDropManager,
    style,
    className,
    innerStyle,
    placeholderRenderer,
    getNodeKey,
  } = mergeTheme(props)

  const treeData = draggingTreeData || props.treeData

  let rows
  let swapFrom
  let swapLength
  if (draggedNode && draggedMinimumTreeIndex !== undefined) {
    const addedResult = memoizedInsertNode({
      treeData,
      newNode: draggedNode,
      depth: draggedDepth,
      minimumTreeIndex: draggedMinimumTreeIndex,
      expandParent: true,
      getNodeKey,
    })

    const swapTo = draggedMinimumTreeIndex
    swapFrom = addedResult.treeIndex
    swapLength = 1 + memoizedGetDescendantCount({ node: draggedNode })
    rows = slideRows(
      getRows(addedResult.treeData),
      swapFrom,
      swapTo,
      swapLength
    )
  } else {
    rows = getRows(props.treeData)
  }

  // Get indices for rows that match the search conditions
  const matchKeys = {}
  for (const [i, { path }] of searchMatches.entries()) {
    matchKeys[path[path.length - 1]] = i
  }

  // Seek to the focused search result if there is one specified
  if (searchFocusTreeIndex !== undefined) {
    listRef.current?.scrollToIndex({
      index: searchFocusTreeIndex,
      align: 'center',
    })
  }

  let containerStyle = style
  let list
  if (rows.length === 0) {
    const PlaceholderContent = placeholderRenderer
    list = (
      <Placeholder treeId={treeId} drop={drop}>
        <PlaceholderContent />
      </Placeholder>
    )
  } else {
    containerStyle = { height: '100%', ...containerStyle }

    list = (
      <ScrollZoneVirtualList
        data={rows}
        listRef={listRef}
        dragDropManager={dragDropManager}
        verticalStrength={vStrength}
        horizontalStrength={hStrength}
        className="rst__virtualScrollOverride"
        style={innerStyle}
        itemContent={(index: number) =>
          renderRow(rows[index], {
            listIndex: index,
            getPrevRow: () => rows[index - 1] || undefined,
            matchKeys,
            swapFrom,
            swapDepth: draggedDepth,
            swapLength,
          })
        }
      />
    )
  }

  return (
    <div className={classnames('rst__tree', className)} style={containerStyle}>
      {list}
    </div>
  )
}

const SortableTreeWithoutDndContext = (props: any) => {
  return (
    <DndContext.Consumer>
      {({ dragDropManager }) =>
        !dragDropManager ? undefined : (
          <ReactSortableTree {...props} dragDropManager={dragDropManager} />
        )
      }
    </DndContext.Consumer>
  )
}

const SortableTree2 = (props: any) => {
  return (
    <DndProvider backend={HTML5Backend}>
      <SortableTreeWithoutDndContext {...props} />
    </DndProvider>
  )
}

// Export the tree component without the react-dnd DragDropContext,
// for when component is used with other components using react-dnd.
// see: https://github.com/gaearon/react-dnd/issues/186
export { SortableTreeWithoutDndContext }

export default SortableTree2
