import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SortableTree } from './react-sortable-tree'
import { TreeItem } from './types'

const sized = (ui: React.ReactElement) => (
  <div style={{ height: 600, width: 800 }}>{ui}</div>
)

/**
 * a (expanded)
 * ├─ a1 (expanded)
 * │  └─ a1a
 * └─ a2
 * b (collapsed)
 * └─ b1
 * c
 */
const tree = (): TreeItem[] => [
  {
    title: 'a',
    expanded: true,
    children: [
      { title: 'a1', expanded: true, children: [{ title: 'a1a' }] },
      { title: 'a2' },
    ],
  },
  { title: 'b', children: [{ title: 'b1' }] },
  { title: 'c' },
]

const Controlled = ({
  initial = tree(),
  ...props
}: { initial?: TreeItem[] } & Record<string, unknown>) => {
  const [treeData, setTreeData] = useState<TreeItem[]>(initial)
  return sized(
    <SortableTree
      treeData={treeData}
      onChange={setTreeData}
      aria-label="Example tree"
      {...props}
    />
  )
}

const items = () => screen.queryAllByRole('treeitem')
const titleOf = (el: Element) => el.querySelector('.rst__rowTitle')?.textContent
const itemTitles = () => items().map((el) => titleOf(el))
const itemByTitle = (title: string) =>
  items().find((el) => titleOf(el) === title)!

describe('ARIA structure', () => {
  it('exposes a labelled tree', () => {
    render(<Controlled />)
    const treeEl = screen.getByRole('tree')
    expect(treeEl).toHaveProperty('tagName', 'DIV')
    expect(treeEl.getAttribute('aria-label')).toBe('Example tree')
  })

  it('supports aria-labelledby instead', () => {
    render(
      <>
        <h2 id="heading">Files</h2>
        <Controlled aria-label={undefined} aria-labelledby="heading" />
      </>
    )
    expect(screen.getByRole('tree').getAttribute('aria-labelledby')).toBe(
      'heading'
    )
  })

  it('exposes one treeitem per visible row', () => {
    render(<Controlled />)
    expect(itemTitles()).toEqual(['a', 'a1', 'a1a', 'a2', 'b', 'c'])
  })

  it('reports depth with aria-level, counting from 1', () => {
    render(<Controlled />)
    const level = (t: string) => itemByTitle(t).getAttribute('aria-level')
    expect(level('a')).toBe('1')
    expect(level('a1')).toBe('2')
    expect(level('a1a')).toBe('3')
    expect(level('c')).toBe('1')
  })

  it('reports sibling position and count', () => {
    render(<Controlled />)
    const pos = (t: string) => [
      itemByTitle(t).getAttribute('aria-posinset'),
      itemByTitle(t).getAttribute('aria-setsize'),
    ]
    // three roots
    expect(pos('a')).toEqual(['1', '3'])
    expect(pos('b')).toEqual(['2', '3'])
    expect(pos('c')).toEqual(['3', '3'])
    // two children of 'a'
    expect(pos('a1')).toEqual(['1', '2'])
    expect(pos('a2')).toEqual(['2', '2'])
    // only child of 'a1'
    expect(pos('a1a')).toEqual(['1', '1'])
  })

  it('sets aria-expanded only on nodes that have children', () => {
    render(<Controlled />)
    expect(itemByTitle('a').getAttribute('aria-expanded')).toBe('true')
    expect(itemByTitle('b').getAttribute('aria-expanded')).toBe('false')
    // leaves must not claim to be expandable
    expect(itemByTitle('c').hasAttribute('aria-expanded')).toBe(false)
    expect(itemByTitle('a1a').hasAttribute('aria-expanded')).toBe(false)
  })

  it('treats a lazy children function as expandable', () => {
    render(<Controlled initial={[{ title: 'lazy', children: () => {} }]} />)
    expect(itemByTitle('lazy').getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps the scroller and row wrappers out of the accessibility tree', () => {
    const { container } = render(<Controlled />)
    // Exactly one tree, and no stray generic containers claiming a role
    expect(screen.getAllByRole('tree')).toHaveLength(1)
    expect(container.querySelector('#vlist')?.getAttribute('role')).toBe('none')
    // Every treeitem's ancestors up to the tree are presentational
    for (const item of items()) {
      let el = item.parentElement
      while (el && el.getAttribute('role') !== 'tree') {
        const role = el.getAttribute('role')
        expect(role === null || role === 'none').toBe(true)
        el = el.parentElement
      }
      expect(el).not.toBeNull() // reached the tree
    }
  })

  it('updates aria-expanded when a node is toggled', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    expect(itemByTitle('b').getAttribute('aria-expanded')).toBe('false')

    await user.click(
      itemByTitle('b').querySelector<HTMLButtonElement>('.rst__expandButton')!
    )

    expect(itemByTitle('b').getAttribute('aria-expanded')).toBe('true')
  })
})

describe('roving tabindex', () => {
  it('makes exactly one row tabbable', () => {
    render(<Controlled />)
    const tabbable = items().filter((el) => el.getAttribute('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
    expect(titleOf(tabbable[0])).toBe('a')
    for (const el of items()) {
      expect(['0', '-1']).toContain(el.getAttribute('tabindex'))
    }
  })

  it('moves the tabbable row as focus moves', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    itemByTitle('a').focus()

    await user.keyboard('{ArrowDown}')

    expect(itemByTitle('a1').getAttribute('tabindex')).toBe('0')
    expect(itemByTitle('a').getAttribute('tabindex')).toBe('-1')
  })

  it('puts the tree on the tab sequence exactly once', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button>before</button>
        <Controlled />
        <button>after</button>
      </>
    )

    screen.getByText('before').focus()
    await user.tab()
    expect(document.activeElement).toBe(itemByTitle('a'))
  })
})

describe('keyboard navigation', () => {
  const focusFirst = () => itemByTitle('a').focus()

  it('moves down and up with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    focusFirst()

    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(itemByTitle('a1'))

    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(itemByTitle('a1a'))

    await user.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(itemByTitle('a1'))
  })

  it('stops at the ends rather than wrapping', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    focusFirst()

    await user.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(itemByTitle('a'))

    await user.keyboard('{End}')
    expect(document.activeElement).toBe(itemByTitle('c'))

    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(itemByTitle('c'))
  })

  it('jumps to first and last with Home and End', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    focusFirst()

    await user.keyboard('{End}')
    expect(document.activeElement).toBe(itemByTitle('c'))

    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(itemByTitle('a'))
  })

  it('expands a collapsed node with ArrowRight', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    itemByTitle('b').focus()

    await user.keyboard('{ArrowRight}')

    expect(itemTitles()).toContain('b1')
    expect(itemByTitle('b').getAttribute('aria-expanded')).toBe('true')
  })

  it('steps into the first child when ArrowRight hits an open node', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    focusFirst()

    await user.keyboard('{ArrowRight}')

    expect(document.activeElement).toBe(itemByTitle('a1'))
  })

  it('collapses an open node with ArrowLeft', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    focusFirst()

    await user.keyboard('{ArrowLeft}')

    expect(itemTitles()).not.toContain('a1')
    expect(itemByTitle('a').getAttribute('aria-expanded')).toBe('false')
  })

  it('moves to the parent when ArrowLeft hits a leaf', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    itemByTitle('a1a').focus()

    await user.keyboard('{ArrowLeft}')

    expect(document.activeElement).toBe(itemByTitle('a1'))
  })

  it('toggles with Enter and Space', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    itemByTitle('b').focus()

    await user.keyboard('{Enter}')
    expect(itemByTitle('b').getAttribute('aria-expanded')).toBe('true')

    await user.keyboard(' ')
    expect(itemByTitle('b').getAttribute('aria-expanded')).toBe('false')
  })

  it('mirrors left and right for rtl trees', async () => {
    const user = userEvent.setup()
    render(<Controlled rowDirection="rtl" />)
    itemByTitle('b').focus()

    // In rtl, ArrowLeft is "forward" and should expand
    await user.keyboard('{ArrowLeft}')
    expect(itemByTitle('b').getAttribute('aria-expanded')).toBe('true')

    await user.keyboard('{ArrowRight}')
    expect(itemByTitle('b').getAttribute('aria-expanded')).toBe('false')
  })

  it('reports keyboard-driven expansion through onVisibilityToggle', async () => {
    const user = userEvent.setup()
    const onVisibilityToggle = vi.fn()
    render(<Controlled onVisibilityToggle={onVisibilityToggle} />)
    itemByTitle('b').focus()

    await user.keyboard('{ArrowRight}')

    expect(onVisibilityToggle).toHaveBeenCalledTimes(1)
    expect(onVisibilityToggle.mock.calls[0][0]).toMatchObject({
      expanded: true,
      node: expect.objectContaining({ title: 'b' }),
    })
  })

  it('leaves unrelated keys alone', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    focusFirst()

    await user.keyboard('{PageDown}')
    await user.keyboard('a')

    expect(document.activeElement).toBe(itemByTitle('a'))
    expect(itemTitles()).toEqual(['a', 'a1', 'a1a', 'a2', 'b', 'c'])
  })

  it('does not hijack typing in a nested input', async () => {
    const user = userEvent.setup()
    render(
      <Controlled
        generateNodeProps={() => ({
          buttons: [<input key="edit" aria-label="rename" />],
        })}
      />
    )
    const input = screen.getAllByLabelText('rename')[0]
    input.focus()

    await user.keyboard('{ArrowDown}hi')

    expect(document.activeElement).toBe(input)
    expect((input as HTMLInputElement).value).toBe('hi')
  })

  it('can be turned off with keyboardNavigation={false}', async () => {
    const user = userEvent.setup()
    render(<Controlled keyboardNavigation={false} />)
    focusFirst()

    await user.keyboard('{ArrowDown}')

    // Roles and the roving tabindex remain, only the key handling is gone
    expect(document.activeElement).toBe(itemByTitle('a'))
    expect(screen.getByRole('tree')).toBeDefined()
  })
})
