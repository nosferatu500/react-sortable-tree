import { DndProvider, useDragDropManager } from '@nosferatu500/react-dnd'
import { TestBackend } from '@nosferatu500/react-dnd-test-backend'
import { act, render } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SortableTreeWithoutDndContext } from '../react-sortable-tree'
import { at, childrenOf } from '../test-helpers'
import type { TreeItem } from '../types'

/**
 * Drives real drags through react-dnd's TestBackend.
 *
 * Handler ids are not exposed by any public API, so they are read off the
 * manager's registry, where registration is one source + one target per row in
 * row order (`S0, T1, S2, T3, …`). The first test in this file pins that layout,
 * so if it ever changes these tests fail there rather than silently dragging the
 * wrong row everywhere else.
 *
 * A handler belongs to a row *instance*, not to a screen position: rows are
 * keyed by node identity (see `node-identity.ts`), so an instance — and its
 * handler id — travels with its node when the order changes, which a drag's own
 * preview does. A browser hovers whatever element sits under the cursor, so
 * `beginDrag(i)` / `hover(i)` resolve the id for the row *currently* at index `i`
 * through the title→id map captured at mount. Addressing handlers by
 * registration order instead would silently mean "the node that started at
 * index i".
 */
interface TestManager {
  getRegistry: () => { types: Map<string, unknown> }
  getBackend: () => {
    simulateBeginDrag: (ids: string[], options?: unknown) => void
    simulateHover: (ids: string[], options?: unknown) => void
    simulateDrop: () => void
    simulateEndDrag: () => void
  }
}

const rowTitles = () =>
  [...document.querySelectorAll('.rst__rowTitle')].map((el) => el.textContent)

const flatTree = (): TreeItem[] => [
  { title: 'a' },
  { title: 'b' },
  { title: 'c' },
]

const nestedTree = (): TreeItem[] => [
  { title: 'parent', expanded: true, children: [{ title: 'child' }] },
  { title: 'sibling' },
]

const Capture = ({ onReady }: { onReady: (m: TestManager) => void }) => {
  const manager = useDragDropManager() as unknown as TestManager
  // Block body on purpose: returning onReady's value would hand React a
  // non-function "cleanup".
  React.useEffect(() => {
    onReady(manager)
  }, [manager, onReady])
  return null
}

/** Host that owns the tree state, as a real consumer would. */
const Host = ({
  initial,
  onChange,
  ...props
}: {
  initial: TreeItem[]
  onChange?: (t: TreeItem[]) => void
} & Record<string, unknown>) => {
  const [treeData, setTreeData] = React.useState(initial)
  return (
    <div style={{ height: 600, width: 800 }}>
      <SortableTreeWithoutDndContext
        treeData={treeData}
        onChange={(next) => {
          setTreeData(next)
          onChange?.(next)
        }}
        {...props}
      />
    </div>
  )
}

/**
 * Renders a tree behind the TestBackend and returns drag primitives addressed
 * by row index.
 */
const renderTree = (
  initial: TreeItem[],
  props: Record<string, unknown> = {}
) => {
  let manager!: TestManager
  const result = render(
    <DndProvider backend={TestBackend}>
      <Capture onReady={(m) => (manager = m)} />
      <Host initial={initial} {...props} />
    </DndProvider>
  )

  const handlers = () => {
    const keys = manager.getRegistry().types.keys().toArray()
    return {
      sources: keys.filter((k) => k.startsWith('S')),
      targets: keys.filter((k) => k.startsWith('T')),
    }
  }
  const backend = () => manager.getBackend()

  // Registration order is row order at mount, so this pins each row's handlers
  // to its title while the two still line up.
  const mounted = handlers()
  const byTitle = new Map(
    rowTitles().map((title, i) => [
      title,
      { source: at(mounted.sources, i), target: at(mounted.targets, i) },
    ])
  )

  /** The handlers of whichever row is at `index` right now. */
  const rowHandlers = (index: number) => {
    const title = at(rowTitles(), index)
    const found = byTitle.get(title)
    if (!found) {
      throw new Error(
        `no handlers for the row at index ${index} ("${title}") — it ` +
          `mounted after the initial render, so its ids were never captured`
      )
    }
    return found
  }

  return {
    ...result,
    handlers,
    beginDrag: (row: number) =>
      act(() => backend().simulateBeginDrag([rowHandlers(row).source])),
    /** Exactly one `dragover`, the way a single keypress or one test event does. */
    hoverOnce: (row: number) =>
      act(() => backend().simulateHover([rowHandlers(row).target])),
    /**
     * Hovers the row at `index`, then keeps hovering whatever ends up there
     * until the preview settles — which is what a browser does, firing
     * `dragover` continuously while the pointer sits still.
     *
     * This used to be load-bearing: a drop recomputed its position from row
     * props the preview had already slid, so one hover followed by a drop landed
     * the node back where it started, and repeating hovers was what converged
     * it. The drop now commits the previewed position instead (see `moveNode`),
     * so a single hover is enough — `hoverOnce` pins that.
     */
    hover: (row: number) => {
      let previous = ''
      for (let i = 0; i < 5; i += 1) {
        act(() => backend().simulateHover([rowHandlers(row).target]))
        const current = rowTitles().join(',')
        if (current === previous) break
        previous = current
      }
    },
    drop: () => act(() => backend().simulateDrop()),
    endDrag: () => act(() => backend().simulateEndDrag()),
  }
}

describe('handler registration', () => {
  it('registers one drag source and one drop target per visible row', () => {
    const { handlers } = renderTree(flatTree())
    const { sources, targets } = handlers()
    expect(sources).toHaveLength(3)
    expect(targets).toHaveLength(3)
  })

  it('registers a placeholder drop target and no sources when empty', () => {
    const { handlers } = renderTree([])
    const { sources, targets } = handlers()
    expect(targets).toHaveLength(1) // the placeholder accepts external drops
    expect(sources).toHaveLength(0) // nothing to pick up
  })
})

describe('drag lifecycle', () => {
  it('reports drag start and end through onDragStateChanged', () => {
    const onDragStateChanged = vi.fn()
    const { beginDrag, endDrag } = renderTree(flatTree(), {
      onDragStateChanged,
    })

    beginDrag(0)
    expect(onDragStateChanged).toHaveBeenCalledTimes(1)
    expect(at(onDragStateChanged.mock.calls, 0)[0]).toMatchObject({
      isDragging: true,
      draggedNode: expect.objectContaining({ title: 'a' }),
    })

    endDrag()
    expect(onDragStateChanged).toHaveBeenCalledTimes(2)
    expect(at(onDragStateChanged.mock.calls, 1)[0].isDragging).toBe(false)
  })

  it('keeps the dragged row rendered at its drag position', () => {
    const { beginDrag } = renderTree(flatTree())
    expect(rowTitles()).toEqual(['a', 'b', 'c'])

    beginDrag(0)

    // The node is lifted out of the working tree but re-inserted at the current
    // drag position for display, so the row list is unchanged until it moves.
    expect(rowTitles()).toEqual(['a', 'b', 'c'])
  })

  it('restores the tree when a drag is cancelled', () => {
    const onChange = vi.fn()
    const { beginDrag, endDrag } = renderTree(flatTree(), { onChange })

    beginDrag(0)
    endDrag() // no drop result == cancelled

    expect(rowTitles()).toEqual(['a', 'b', 'c'])
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('drop', () => {
  it('reorders the tree and reports the move', () => {
    const onMoveNode = vi.fn()
    const { beginDrag, hover, drop } = renderTree(flatTree(), { onMoveNode })

    beginDrag(0) // pick up 'a'
    hover(1) // hover the row below it
    drop()

    expect(rowTitles()).toEqual(['b', 'a', 'c'])
    expect(onMoveNode).toHaveBeenCalledTimes(1)
    const move = at(onMoveNode.mock.calls, 0)[0]
    expect(move.node.title).toBe('a')
    expect(move.treeData.map((n: TreeItem) => n.title)).toEqual(['b', 'a', 'c'])
    expect(move.prevPath).toEqual([0])
    expect(move.nextPath).toBeDefined()
    // what the consumer is told matches what is rendered
    expect(move.treeData.map((n: TreeItem) => n.title)).toEqual(rowTitles())
  })

  it('gives onMoveNode a nextPath that locates the node in the new tree', () => {
    const onMoveNode = vi.fn()
    const { beginDrag, hover, drop } = renderTree(flatTree(), { onMoveNode })

    beginDrag(2) // 'c'
    hover(0)
    drop()

    const { treeData, nextPath, nextTreeIndex } = at(
      onMoveNode.mock.calls,
      0
    )[0]
    // nextPath is a list of treeIndexes under the default getNodeKey, so the
    // last segment is the node's own index in the new tree.
    expect(nextPath.at(-1)).toBe(nextTreeIndex)
    const flat = treeData.map((n: TreeItem) => n.title)
    expect(flat).toContain('c')
  })

  it('persists the drop through onChange', () => {
    const onChange = vi.fn()
    const { beginDrag, hover, drop } = renderTree(flatTree(), { onChange })

    beginDrag(0)
    hover(1)
    drop()

    expect(onChange).toHaveBeenCalled()
    // the tree handed to onChange is the one now on screen
    expect(
      (onChange.mock.lastCall![0] as TreeItem[]).map((n) => n.title)
    ).toEqual(rowTitles())
  })
})

describe('drop position', () => {
  it('lands where the preview showed it, after a single hover', () => {
    const onMoveNode = vi.fn()
    const { beginDrag, hoverOnce, drop } = renderTree(flatTree(), {
      onMoveNode,
    })

    beginDrag(0) // pick up 'a'
    hoverOnce(1) // one dragover, as a keyboard drag or a lone test event gives
    const previewed = rowTitles()
    expect(previewed).toEqual(['b', 'a', 'c'])

    drop()

    // What was committed is what was on screen, rather than the node snapping
    // back to where it was picked up from.
    expect(rowTitles()).toEqual(previewed)
    expect(
      (onMoveNode.mock.lastCall![0].treeData as TreeItem[]).map((n) => n.title)
    ).toEqual(previewed)
  })
})

describe('canDrop', () => {
  it('is consulted with both endpoints', () => {
    const canDrop = vi.fn((_params: Record<string, unknown>) => true)
    const { beginDrag, hover } = renderTree(flatTree(), { canDrop })

    beginDrag(0)
    hover(1)

    expect(canDrop).toHaveBeenCalled()
    const arg = canDrop.mock.calls.at(-1)![0]
    expect(arg).toMatchObject({
      node: expect.objectContaining({ title: 'a' }),
      prevPath: [0],
    })
    expect(arg['nextPath']).toBeDefined()
  })

  it('blocks the drop when it returns false', () => {
    const onMoveNode = vi.fn()
    const { beginDrag, hover, drop, endDrag } = renderTree(flatTree(), {
      canDrop: () => false,
      onMoveNode,
    })

    beginDrag(0)
    hover(1)
    drop()
    endDrag()

    expect(onMoveNode).not.toHaveBeenCalled()
    expect(rowTitles()).toEqual(['a', 'b', 'c'])
  })
})

describe('nested trees', () => {
  it('keeps a dragged parent and its children together', () => {
    const onMoveNode = vi.fn()
    const { beginDrag, hover, drop } = renderTree(nestedTree(), { onMoveNode })
    expect(rowTitles()).toEqual(['parent', 'child', 'sibling'])

    beginDrag(0) // pick up 'parent', which owns 'child'
    hover(2)
    drop()

    // wherever the parent lands, the child stays under it
    const moved = at(onMoveNode.mock.calls, 0)[0].treeData as TreeItem[]
    const parent = moved.find((n) => n.title === 'parent')!
    expect(childrenOf(parent).map((c) => c.title)).toEqual(['child'])
    expect(rowTitles()).toContain('child')
  })

  it('reports the parent in onMoveNode when dropping into a subtree', () => {
    const onMoveNode = vi.fn()
    const { beginDrag, hover, drop } = renderTree(nestedTree(), { onMoveNode })

    beginDrag(2) // 'sibling'
    hover(1) // hover 'child'
    drop()

    expect(onMoveNode).toHaveBeenCalledTimes(1)
    const move = at(onMoveNode.mock.calls, 0)[0]
    expect(move.node.title).toBe('sibling')
    // nextParentNode is either null (root level) or a real node — never
    // undefined, and never a node the tree doesn't contain.
    if (move.nextParentNode !== null) {
      expect(move.nextParentNode).toHaveProperty('title')
    }
  })
})
