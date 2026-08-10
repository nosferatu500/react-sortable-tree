import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
// Deliberately the *built* bundle rather than `src`: this is React Compiler
// output, and nothing else in the suite exercises it.
import { SortableTree, type TreeItem } from '../lib/index.js'

/**
 * Smoke tests for the published build.
 *
 * 6.0.0 shipped `ReferenceError: dndType is not defined` on any empty tree. The
 * compiler had outlined the placeholder's `useDrop` spec to module scope, where
 * the `dndType` it closed over — a parameter of `wrapPlaceholder` — did not
 * exist. The whole suite passed, because it runs against `src`.
 *
 * So these render the real bundle through the paths whose callbacks the compiler
 * outlined: the placeholder, and a drag from beginning to end.
 */

const Host = ({
  initial,
  ...props
}: { initial: TreeItem[] } & Record<string, unknown>) => {
  const [treeData, setTreeData] = useState<TreeItem[]>(initial)
  return (
    <div style={{ height: 400, width: 600 }}>
      <SortableTree
        treeData={treeData}
        onChange={setTreeData}
        aria-label="Built bundle tree"
        {...props}
      />
    </div>
  )
}

const items = () => screen.queryAllByRole('treeitem')
const titleOf = (el: Element) => el.querySelector('.rst__rowTitle')?.textContent
const itemTitles = () => items().map((el) => titleOf(el))

describe('built bundle', () => {
  it('renders an empty tree — the placeholder path that 6.0.0 crashed on', () => {
    expect(() => render(<Host initial={[]} />)).not.toThrow()
  })

  it('renders rows', () => {
    render(<Host initial={[{ title: 'a' }, { title: 'b' }]} />)
    expect(itemTitles()).toEqual(['a', 'b'])
  })

  it('expands and collapses', async () => {
    const user = userEvent.setup()
    render(
      <Host initial={[{ title: 'parent', children: [{ title: 'child' }] }]} />
    )
    expect(itemTitles()).toEqual(['parent'])

    await user.click(screen.getByRole('button', { name: 'Expand' }))
    expect(itemTitles()).toEqual(['parent', 'child'])
  })

  it('completes a keyboard drag, which exercises the outlined drag callbacks', async () => {
    const user = userEvent.setup()
    const onMoveNode = vi.fn()
    render(
      <Host
        initial={[{ title: 'a' }, { title: 'b' }, { title: 'c' }]}
        onMoveNode={onMoveNode}
      />
    )

    const handle = items()[0]!.querySelector<HTMLElement>('.rst__moveHandle')!
    handle.focus()
    await user.keyboard(' ') // pick up — runs the source's `item()`/`begin`
    await user.keyboard('{ArrowDown}')
    await user.keyboard(' ') // drop — runs `drop` and then the source's `end`

    expect(onMoveNode).toHaveBeenCalled()
    expect(itemTitles()).toEqual(['b', 'a', 'c'])
  })

  it('exposes the tree-data helpers and the backend composer', async () => {
    const lib = await import('../lib/index.js')
    expect(typeof lib.getTreeFromFlatData).toBe('function')
    expect(typeof lib.withTreeKeyboard).toBe('function')
    expect(typeof lib.SortableTreeWithoutDndContext).toBe('function')
  })
})
