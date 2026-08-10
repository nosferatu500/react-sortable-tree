import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SortableTree } from './react-sortable-tree'
import { at } from './test-helpers'
import type { TreeItem } from './types'

/**
 * Keyboard drag and drop, driven through the real keyboard backend.
 *
 * The backend listens on the document in the capture phase, so these tests
 * dispatch ordinary key events at the focused handle and let them propagate,
 * rather than reaching into the backend.
 */

const sized = (ui: React.ReactElement) => (
  <div style={{ height: 600, width: 800 }}>{ui}</div>
)

const flat = (): TreeItem[] => [{ title: 'a' }, { title: 'b' }, { title: 'c' }]

const Controlled = ({
  initial = flat(),
  onChange,
  ...props
}: {
  initial?: TreeItem[]
  onChange?: (t: TreeItem[]) => void
} & Record<string, unknown>) => {
  const [treeData, setTreeData] = useState<TreeItem[]>(initial)
  return sized(
    <SortableTree
      treeData={treeData}
      onChange={(next) => {
        setTreeData(next)
        onChange?.(next)
      }}
      aria-label="Example tree"
      {...props}
    />
  )
}

const items = () => screen.queryAllByRole('treeitem')
const titleOf = (el: Element) => el.querySelector('.rst__rowTitle')?.textContent
const itemTitles = () => items().map((el) => titleOf(el))
const handles = () => [
  ...document.querySelectorAll<HTMLElement>('.rst__moveHandle'),
]
/** The move handle of the row currently at `index`. */
const handleAt = (index: number) => {
  const row = items()[index]!
  return row.querySelector<HTMLElement>('.rst__moveHandle')!
}
const liveRegion = () => screen.queryByRole('status')?.textContent ?? ''
/** Depth of each row, from the scaffold blocks the renderer emits. */
const depths = () =>
  items().map((el) => el.querySelectorAll('.rst__lineBlock').length)

describe('drag handle and the roving tabindex', () => {
  it('keeps the tree a single tab stop', () => {
    render(<Controlled />)
    // The backend makes every drag source focusable, but it defers to a
    // tabindex that is already present — so only the active row's handle is
    // reachable, exactly like the rows themselves.
    expect(handles().map((h) => h.tabIndex)).toEqual([0, -1, -1])
    expect(items().map((el) => (el as HTMLElement).tabIndex)).toEqual([
      0, -1, -1,
    ])
  })

  it('gives the handle an accessible name, so announcements are not empty', () => {
    render(<Controlled />)
    // The backend describes a source by its aria-label, falling back to text
    // content — and the handle has none of its own.
    expect(handleAt(0).getAttribute('aria-label')).toBe('Drag a')
  })

  it('lets the backend describe the handle to assistive tech', () => {
    render(<Controlled />)
    const handle = handleAt(0)
    // A `div role="button"`, not a real `<button>`: browsers are unreliable at
    // dragging form controls, and being draggable is this element's job.
    expect(handle.getAttribute('role')).toBe('button')
    expect(handle.getAttribute('aria-roledescription')).toBe('draggable item')
    // Points at the backend's shared instructions element.
    expect(handle.getAttribute('aria-describedby')).toBeTruthy()
  })
})

describe('keyboard drag', () => {
  it('picks a row up and announces it', async () => {
    const user = userEvent.setup()
    render(<Controlled />)

    handleAt(0).focus()
    await user.keyboard(' ')

    expect(liveRegion()).toMatch(/picked up/i)
    expect(liveRegion()).toMatch(/Drag a/i)
  })

  it('does not move the row merely by picking it up', async () => {
    const user = userEvent.setup()
    render(<Controlled />)

    // The last row, which is where this used to be visible: the backend hovered
    // the first eligible target on pick-up, so lifting 'c' previewed it jumping
    // to the top before the user had pressed anything. It now prefers the target
    // containing the source.
    handleAt(2).focus()
    await user.keyboard(' ')

    expect(itemTitles()).toEqual(['a', 'b', 'c'])
    expect(liveRegion()).toMatch(/over c/i)
  })

  it('reorders the tree when dropped on another row', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    expect(itemTitles()).toEqual(['a', 'b', 'c'])

    handleAt(0).focus()
    await user.keyboard(' ') // pick up 'a'
    await user.keyboard('{ArrowDown}') // move down a row
    await user.keyboard(' ') // drop

    expect(onChange).toHaveBeenCalled()
    expect(itemTitles()).not.toEqual(['a', 'b', 'c'])
  })

  it('leaves the tree untouched when cancelled with escape', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)

    handleAt(0).focus()
    await user.keyboard(' ')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Escape}')

    expect(itemTitles()).toEqual(['a', 'b', 'c'])
    expect(onChange).not.toHaveBeenCalled()
  })
})

/**
 * A node can only nest under the row above the insertion point, so these move
 * the hover somewhere that has a row above it before asking for depth. The two
 * cases differ by exactly one keypress.
 */
describe('depth control', () => {
  /** Lands 'a' below 'b', optionally asking for one more level on the way. */
  const dragAOntoB = async (
    user: ReturnType<typeof userEvent.setup>,
    { deeper }: { deeper: boolean }
  ) => {
    handleAt(0).focus()
    await user.keyboard(' ')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{ArrowDown}')
    if (deeper) await user.keyboard('{ArrowRight}')
    await user.keyboard(' ')
  }

  it('nests the dragged row when the deeper arrow is pressed', async () => {
    const user = userEvent.setup()
    const onMoveNode = vi.fn()
    render(<Controlled onMoveNode={onMoveNode} />)
    expect(depths()).toEqual([1, 1, 1])

    await dragAOntoB(user, { deeper: true })

    const move = onMoveNode.mock.lastCall![0]
    expect(move.node.title).toBe('a')
    expect(move.nextPath).toHaveLength(2)
    expect(move.nextParentNode?.title).toBe('b')
    // And the rendered scaffold agrees that a row is now nested.
    expect(Math.max(...depths())).toBe(2)
  })

  it('leaves the row at its own depth without a horizontal press', async () => {
    const user = userEvent.setup()
    const onMoveNode = vi.fn()
    render(<Controlled onMoveNode={onMoveNode} />)

    await dragAOntoB(user, { deeper: false })

    const move = onMoveNode.mock.lastCall![0]
    expect(move.nextPath).toHaveLength(1)
    expect(depths()).toEqual([1, 1, 1])
  })

  it('announces the new depth, since the backend cannot', async () => {
    const user = userEvent.setup()
    render(<Controlled />)

    handleAt(0).focus()
    await user.keyboard(' ')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{ArrowRight}')

    // The tree took this key through `onNavigate`, so the backend said nothing
    // about it. Silence is indistinguishable from a key that did nothing.
    expect(liveRegion()).toMatch(/depth 2/i)
  })

  it('says so when a depth request is refused', async () => {
    const user = userEvent.setup()
    render(<Controlled />)

    handleAt(0).focus()
    await user.keyboard(' ')
    // Hovering its own row at the top, where there is nothing above to nest
    // under, so the request clamps.
    await user.keyboard('{ArrowRight}')

    expect(liveRegion()).toMatch(/unchanged/i)
  })

  it('un-nests again when the shallower arrow is pressed', async () => {
    const user = userEvent.setup()
    const onMoveNode = vi.fn()
    render(<Controlled onMoveNode={onMoveNode} />)

    handleAt(0).focus()
    await user.keyboard(' ')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{ArrowRight}')
    await user.keyboard('{ArrowLeft}')
    await user.keyboard(' ')

    expect(onMoveNode.mock.lastCall![0].nextPath).toHaveLength(1)
    expect(depths()).toEqual([1, 1, 1])
  })
})

describe('coexistence with the tree’s own key handling', () => {
  it('still toggles children with space on a row', async () => {
    const user = userEvent.setup()
    const nested: TreeItem[] = [
      { title: 'parent', children: [{ title: 'child' }] },
      { title: 'sibling' },
    ]
    render(<Controlled initial={nested} />)
    expect(itemTitles()).toEqual(['parent', 'sibling'])

    // Focus the row, not its handle: the backend only claims keys from inside a
    // drag source, so the tree's own toggle is untouched.
    ;(items()[0] as HTMLElement).focus()
    await user.keyboard(' ')

    expect(itemTitles()).toEqual(['parent', 'child', 'sibling'])
  })

  it('does not move the roving focus while dragging', async () => {
    const user = userEvent.setup()
    render(<Controlled />)

    handleAt(0).focus()
    await user.keyboard(' ')
    const focusedBefore = document.activeElement
    await user.keyboard('{ArrowDown}')

    // The hover moves; focus stays on the dragged item's handle.
    expect(document.activeElement).toBe(focusedBefore)
  })
})

describe('focus after a drop', () => {
  it('leaves the tab stop on the row that moved', async () => {
    const user = userEvent.setup()
    render(<Controlled />)

    handleAt(0).focus()
    await user.keyboard(' ')
    await user.keyboard('{ArrowDown}')
    await user.keyboard(' ')

    expect(itemTitles()).toEqual(['b', 'a', 'c'])
    // Focus never moved — it stayed on the dragged row's handle — so nothing
    // fires the container's `onFocus` sync and the roving index has to be
    // corrected explicitly, or the next arrow key acts on the wrong row.
    const focusedRow = (document.activeElement as HTMLElement).closest(
      '[data-rst-row]'
    )!
    expect(titleOf(focusedRow)).toBe('a')
    const tabbable = items().filter((el) => (el as HTMLElement).tabIndex === 0)
    expect(tabbable).toHaveLength(1)
    expect(titleOf(at(tabbable, 0))).toBe('a')
  })
})

describe('announcing the outcome', () => {
  it('says where the node landed', async () => {
    const user = userEvent.setup()
    render(<Controlled />)

    handleAt(0).focus()
    await user.keyboard(' ')
    await user.keyboard('{ArrowDown}')
    await user.keyboard(' ')

    expect(liveRegion()).toMatch(/moved to depth/i)
  })
})
