import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  SortableTree,
  SortableTreeWithoutDndContext,
} from './react-sortable-tree'
import { at } from './test-helpers'
import type { GetTreeItemChildren, TreeItem, TreeNode } from './types'
import { defaultGetNodeKey } from './utils/default-handlers'
import { changeNodeAtPath } from './utils/tree-data-utils'

/**
 * virtua renders into a scroller whose height jsdom reports as 0, which would
 * leave every row unmounted. Give the container a real box.
 */
const sized = (ui: React.ReactElement) => (
  <div style={{ height: 600, width: 800 }}>{ui}</div>
)

const rowTitles = () =>
  [...document.querySelectorAll('.rst__rowTitle')].map((el) => el.textContent)

const toggleButton = (title: string) => {
  // The expand/collapse button is a sibling of the row content, both inside
  // the same node wrapper.
  const label = [...document.querySelectorAll('.rst__rowTitle')].find(
    (el) => el.textContent === title
  )
  const node = label?.closest('.rst__node')
  return node?.querySelector<HTMLButtonElement>(
    '.rst__expandButton, .rst__collapseButton'
  )
}

const basicTree = (): TreeItem[] => [
  {
    title: 'a',
    expanded: true,
    children: [{ title: 'a1' }, { title: 'a2' }],
  },
  { title: 'b', children: [{ title: 'b1' }] },
  { title: 'c' },
]

/** Controlled wrapper mirroring the documented usage. */
const Controlled = ({
  initial = basicTree(),
  onChangeSpy,
  ...props
}: {
  initial?: TreeItem[]
  onChangeSpy?: (t: TreeItem[]) => void
} & Record<string, unknown>) => {
  const [treeData, setTreeData] = useState<TreeItem[]>(initial)
  return sized(
    <SortableTree
      treeData={treeData}
      onChange={(next) => {
        setTreeData(next)
        onChangeSpy?.(next)
      }}
      {...props}
    />
  )
}

describe('rendering', () => {
  it('renders one row per visible node', () => {
    render(<Controlled />)
    expect(rowTitles()).toEqual(['a', 'a1', 'a2', 'b', 'c'])
  })

  it('hides children of collapsed nodes', () => {
    render(<Controlled />)
    expect(rowTitles()).not.toContain('b1')
  })

  it('renders the placeholder when there is no data', () => {
    render(<Controlled initial={[]} />)
    expect(document.querySelector('.rst__placeholder')).not.toBeNull()
    expect(rowTitles()).toEqual([])
  })

  it('renders subtitles', () => {
    render(<Controlled initial={[{ title: 'a', subtitle: 'sub' }]} />)
    expect(document.querySelector('.rst__rowSubtitle')?.textContent).toBe('sub')
  })

  it('accepts render-function titles', () => {
    // No cast: `TreeItem['title']` accepts a function of the node, which is what
    // the renderer has always supported.
    const title: TreeItem['title'] = ({ node }) => (
      <b>fn:{String(node['id'])}</b>
    )

    render(<Controlled initial={[{ title, id: 7 }]} />)
    expect(document.querySelector('.rst__rowTitle')?.textContent).toBe('fn:7')
  })

  it('accepts render-function subtitles', () => {
    const subtitle: TreeItem['subtitle'] = ({ treeIndex }) => (
      <i>at:{treeIndex}</i>
    )

    render(<Controlled initial={[{ title: 'a', subtitle }]} />)
    expect(document.querySelector('.rst__rowSubtitle')?.textContent).toBe(
      'at:0'
    )
  })

  it('applies rtl direction', () => {
    const { container } = render(<Controlled rowDirection="rtl" />)
    expect(container.querySelector('.rst__tree')?.getAttribute('dir')).toBe(
      'rtl'
    )
    expect(container.querySelector('.rst__rtl')).not.toBeNull()
  })

  it('honours a numeric rowHeight', () => {
    render(<Controlled rowHeight={40} />)
    expect(
      (document.querySelector('.rst__node') as HTMLElement).style.height
    ).toBe('40px')
  })

  it('honours a rowHeight function', () => {
    const rowHeight = vi.fn((treeIndex: number) => 30 + treeIndex * 10)
    render(<Controlled rowHeight={rowHeight} />)
    const heights = [...document.querySelectorAll('.rst__node')].map(
      (n) => (n as HTMLElement).style.height
    )
    expect(heights.slice(0, 3)).toEqual(['30px', '40px', '50px'])
    expect(rowHeight).toHaveBeenCalled()
  })
})

/*
 * A deeply nested row is wider than the viewport and the tree has to scroll
 * sideways to reach its buttons. jsdom has no layout, so it cannot check that a
 * scrollbar appears — what it can check is the one property the fix turns on, and
 * the reason it exists is worth stating here because the property looks arbitrary.
 *
 * Virtua's row wrapper carries `contain: layout style`, and layout containment
 * stops the row's overflow counting towards the scroller's scrollable area:
 * measured in Chrome, the wrapper's own `scrollWidth` reached 654px while the
 * scroller stayed at 620px, so there was nothing to scroll and
 * `contain: strict` on the scroller clipped the row. `benchmark/layout/`
 * has the browser check that actually proves the scrolling.
 */
describe('horizontal scrolling', () => {
  const rowWrapper = () =>
    document.querySelector('.rst__node')!.parentElement as HTMLElement

  it('does not let the row wrapper contain layout', () => {
    render(<Controlled />)
    // The assertion is "no layout containment", not "contain: style" — what
    // breaks scrolling is the `layout` keyword, whatever else is alongside it.
    expect(rowWrapper().style.contain).not.toContain('layout')
  })

  it('keeps each row a stacking context', () => {
    // `contain: layout` also made every row one, and the drop highlight depends
    // on it: `.rst__rowLandingPad::before` is `z-index: -1` and escapes behind an
    // ancestor without it, and the `z-index: 3` drag lines stop being scoped to
    // their own row.
    render(<Controlled />)
    expect(rowWrapper().style.isolation).toBe('isolate')
  })

  it('leaves virtua’s own positioning on the wrapper alone', () => {
    // The style is merged, not replaced: virtua positions every row through it,
    // so dropping any of this would unstack the whole list.
    render(<Controlled />)
    const { style } = rowWrapper()
    expect(style.position).toBe('absolute')
    expect(style.width).toBe('100%')
    expect(style.left).toBe('0px')
  })
})

describe('expand and collapse', () => {
  it('expands a collapsed node and reveals its children', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    expect(rowTitles()).not.toContain('b1')

    await user.click(toggleButton('b')!)

    expect(rowTitles()).toContain('b1')
  })

  it('collapses an expanded node and hides its children', async () => {
    const user = userEvent.setup()
    render(<Controlled />)

    await user.click(toggleButton('a')!)

    expect(rowTitles()).not.toContain('a1')
  })

  it('calls onChange with the updated tree', async () => {
    const user = userEvent.setup()
    const onChangeSpy = vi.fn()
    const initial = basicTree()
    render(<Controlled initial={initial} onChangeSpy={onChangeSpy} />)

    await user.click(toggleButton('b')!)

    expect(onChangeSpy).toHaveBeenCalledTimes(1)
    const next = at(onChangeSpy.mock.calls, 0)[0] as TreeItem[]
    expect(at(next, 1).expanded).toBe(true)
    // The toggled node is a fresh object; untouched siblings are carried over
    // by reference, so consumers can diff cheaply.
    expect(next[1]).not.toBe(initial[1])
    expect(next[0]).toBe(initial[0])
    expect(next[2]).toBe(initial[2])
    expect(at(initial, 1).expanded).toBeUndefined() // input not mutated
  })

  it('calls onVisibilityToggle with node, path and the new expanded state', async () => {
    const user = userEvent.setup()
    const onVisibilityToggle = vi.fn()
    render(<Controlled onVisibilityToggle={onVisibilityToggle} />)

    await user.click(toggleButton('b')!)

    expect(onVisibilityToggle).toHaveBeenCalledTimes(1)
    const arg = at(onVisibilityToggle.mock.calls, 0)[0]
    expect(arg.expanded).toBe(true)
    expect(arg.node.title).toBe('b')
    expect(arg.path).toEqual([3])
    expect(arg.treeData).toBeDefined()
  })

  it('shows no toggle for childless nodes', () => {
    render(<Controlled />)
    expect(toggleButton('c')).toBeFalsy()
    expect(toggleButton('a')).toBeTruthy()
  })

  it('labels the toggle for assistive tech', () => {
    render(<Controlled />)
    expect(toggleButton('a')?.getAttribute('aria-label')).toBe('Collapse')
    expect(toggleButton('b')?.getAttribute('aria-label')).toBe('Expand')
  })
})

describe('search', () => {
  it('marks matching rows', async () => {
    render(<Controlled searchQuery="a1" />)
    await waitFor(() => {
      expect(document.querySelectorAll('.rst__rowSearchMatch')).toHaveLength(1)
    })
    expect(
      document
        .querySelector('.rst__rowSearchMatch')
        ?.querySelector('.rst__rowTitle')?.textContent
    ).toBe('a1')
  })

  it('reports matches through searchFinishCallback', async () => {
    const searchFinishCallback = vi.fn()
    render(
      <Controlled searchQuery="a" searchFinishCallback={searchFinishCallback} />
    )
    await waitFor(() => expect(searchFinishCallback).toHaveBeenCalled())
    const matches = searchFinishCallback.mock.lastCall![0]
    expect(matches.map((m: { node: TreeItem }) => m.node.title)).toEqual([
      'a',
      'a1',
      'a2',
    ])
  })

  it('expands collapsed ancestors to reveal a match', async () => {
    render(<Controlled searchQuery="b1" />)
    await waitFor(() => expect(rowTitles()).toContain('b1'))
  })

  it('marks the focused match', async () => {
    render(<Controlled searchQuery="a" searchFocusOffset={1} />)
    await waitFor(() => {
      expect(document.querySelectorAll('.rst__rowSearchFocus')).toHaveLength(1)
    })
    expect(
      document
        .querySelector('.rst__rowSearchFocus')
        ?.querySelector('.rst__rowTitle')?.textContent
    ).toBe('a1')
  })

  // The old range check was `searchFocusOffset < searchMatches.length`, which
  // let a negative offset through into `searchMatches[-1].treeIndex`.
  it.each([-1, 99])(
    'ignores a searchFocusOffset of %i, which addresses no match',
    async (searchFocusOffset) => {
      render(
        <Controlled searchQuery="a" searchFocusOffset={searchFocusOffset} />
      )
      await waitFor(() => {
        expect(document.querySelectorAll('.rst__rowSearchMatch')).toHaveLength(
          3
        )
      })
      expect(document.querySelectorAll('.rst__rowSearchFocus')).toHaveLength(0)
    }
  )

  it('uses a custom searchMethod', async () => {
    const searchMethod = vi.fn(
      ({ node }: { node: TreeItem }) => node['tag'] === 'wanted'
    )
    render(
      <Controlled
        initial={[{ title: 'x', tag: 'wanted' }, { title: 'y' }]}
        searchQuery="ignored"
        searchMethod={searchMethod}
      />
    )
    await waitFor(() => {
      expect(document.querySelectorAll('.rst__rowSearchMatch')).toHaveLength(1)
    })
    expect(
      document.querySelector('.rst__rowSearchMatch')?.textContent
    ).toContain('x')
  })

  it('collapses non-matching branches with onlyExpandSearchedNodes', async () => {
    render(<Controlled searchQuery="b1" onlyExpandSearchedNodes />)
    await waitFor(() => expect(rowTitles()).toContain('b1'))
    // 'a' started expanded but does not match, so it is collapsed away
    expect(rowTitles()).not.toContain('a1')
  })

  it('reports zero matches when nothing matches', async () => {
    const searchFinishCallback = vi.fn()
    render(
      <Controlled
        searchQuery="zzz"
        searchFinishCallback={searchFinishCallback}
      />
    )
    await waitFor(() => expect(searchFinishCallback).toHaveBeenCalled())
    expect(searchFinishCallback.mock.lastCall![0]).toEqual([])
    expect(document.querySelectorAll('.rst__rowSearchMatch')).toHaveLength(0)
  })
})

describe('generateNodeProps', () => {
  it('receives per-row context and forwards props to the node renderer', () => {
    const generateNodeProps = vi.fn((_params: Record<string, unknown>) => ({
      className: 'injected',
    }))
    render(<Controlled generateNodeProps={generateNodeProps} />)

    expect(document.querySelectorAll('.injected').length).toBeGreaterThan(0)
    const arg = at(generateNodeProps.mock.calls, 0)[0]
    expect(arg).toMatchObject({
      node: expect.objectContaining({ title: 'a' }),
      path: [0],
      treeIndex: 0,
      isSearchMatch: false,
      isSearchFocus: false,
    })
    expect(arg['lowerSiblingCounts']).toEqual([2])
  })

  it('can inject toolbar buttons', () => {
    render(
      <Controlled
        generateNodeProps={() => ({ buttons: [<button key="x">act</button>] })}
      />
    )
    expect(screen.getAllByText('act')).toHaveLength(rowTitles().length)
  })
})

describe('canDrag', () => {
  it('renders a drag handle by default', () => {
    render(<Controlled />)
    expect(document.querySelectorAll('.rst__moveHandle')).toHaveLength(
      rowTitles().length
    )
  })

  it('removes handles when canDrag is false', () => {
    render(<Controlled canDrag={false} />)
    expect(document.querySelectorAll('.rst__moveHandle')).toHaveLength(0)
    expect(
      document.querySelectorAll('.rst__rowContentsDragDisabled')
    ).toHaveLength(rowTitles().length)
  })

  it('supports a per-node canDrag predicate', () => {
    render(
      <Controlled
        canDrag={({ node }: { node: TreeItem }) => node.title !== 'a'}
      />
    )
    const rows = [...document.querySelectorAll('.rst__node')]
    const handleFor = (title: string) =>
      rows
        .find((r) => within(r as HTMLElement).queryByText(title))
        ?.querySelector('.rst__moveHandle')
    expect(handleFor('a')).toBeNull()
    expect(handleFor('a1')).not.toBeNull()
  })
})

describe('custom renderers and theme', () => {
  it('uses a custom nodeContentRenderer', () => {
    const Custom = ({ node }: { node: TreeItem }) => (
      <div data-testid="custom">{String(node.title)}</div>
    )
    render(<Controlled nodeContentRenderer={Custom} />)
    expect(screen.getAllByTestId('custom').map((n) => n.textContent)).toEqual([
      'a',
      'a1',
      'a2',
      'b',
      'c',
    ])
  })

  it('uses a custom placeholderRenderer when empty', () => {
    const Placeholder = () => <div data-testid="empty">nothing here</div>
    render(<Controlled initial={[]} placeholderRenderer={Placeholder} />)
    expect(screen.getByTestId('empty')).toBeDefined()
  })

  it('reads renderers and dimensions from the theme prop', () => {
    const Custom = ({ node }: { node: TreeItem }) => (
      <div data-testid="themed">{String(node.title)}</div>
    )
    render(
      <Controlled
        theme={{ nodeContentRenderer: Custom, scaffoldBlockPxWidth: 12 }}
      />
    )
    expect(screen.getAllByTestId('themed')).toHaveLength(5)
  })

  it('lets a direct prop win over the theme', () => {
    const FromTheme = () => <div data-testid="from-theme" />
    const FromProp = () => <div data-testid="from-prop" />
    render(
      <Controlled
        nodeContentRenderer={FromProp}
        theme={{ nodeContentRenderer: FromTheme }}
      />
    )
    expect(screen.queryAllByTestId('from-theme')).toHaveLength(0)
    expect(screen.getAllByTestId('from-prop').length).toBeGreaterThan(0)
  })

  it('applies scaffoldBlockPxWidth to the indentation blocks', () => {
    render(<Controlled scaffoldBlockPxWidth={17} />)
    const block = document.querySelector('.rst__lineBlock') as HTMLElement
    expect(block.style.width).toBe('17px')
  })
})

describe('controlled treeData', () => {
  it('re-renders when the parent replaces treeData', () => {
    const Wrapper = ({ data }: { data: TreeItem[] }) =>
      sized(<SortableTree treeData={data} onChange={() => {}} />)

    const { rerender } = render(<Wrapper data={[{ title: 'first' }]} />)
    expect(rowTitles()).toEqual(['first'])

    rerender(<Wrapper data={[{ title: 'second' }, { title: 'third' }]} />)
    expect(rowTitles()).toEqual(['second', 'third'])
  })

  it('drops to the placeholder when treeData empties', () => {
    const Wrapper = ({ data }: { data: TreeItem[] }) =>
      sized(<SortableTree treeData={data} onChange={() => {}} />)

    const { rerender } = render(<Wrapper data={[{ title: 'only' }]} />)
    rerender(<Wrapper data={[]} />)
    expect(document.querySelector('.rst__placeholder')).not.toBeNull()
  })
})

describe('lazy children', () => {
  it('invokes the children function for an expanded node and applies the result', async () => {
    const children = vi.fn((_data: GetTreeItemChildren) => [
      { title: 'loaded' },
    ])
    render(
      <Controlled initial={[{ title: 'lazy', expanded: true, children }]} />
    )

    await waitFor(() => expect(rowTitles()).toContain('loaded'))
    expect(children).toHaveBeenCalled()
    const arg = at(children.mock.calls, 0)[0]
    expect(arg.node.title).toBe('lazy')
    expect(arg.path).toEqual([0])
    expect(arg.treeIndex).toBe(0)
  })

  it('leaves collapsed lazy children alone by default', () => {
    const children = vi.fn()
    render(<Controlled initial={[{ title: 'lazy', children }]} />)
    expect(children).not.toHaveBeenCalled()
  })

  it('loads collapsed lazy children when loadCollapsedLazyChildren is set', () => {
    const children = vi.fn()
    render(
      <Controlled
        initial={[{ title: 'lazy', children }]}
        loadCollapsedLazyChildren
      />
    )
    expect(children).toHaveBeenCalled()
  })

  it('shows a loading handle for a pending lazy node', () => {
    const never = () => new Promise<TreeItem[]>(() => {})
    render(
      <Controlled
        initial={[{ title: 'lazy', expanded: true, children: never }]}
      />
    )
    expect(document.querySelector('.rst__loadingHandle')).not.toBeNull()
  })

  it('applies children returned as a promise', async () => {
    const children = vi.fn(async ({ node }: GetTreeItemChildren) => [
      { title: `${String(node.title)}-async` },
    ])
    render(
      <Controlled initial={[{ title: 'lazy', expanded: true, children }]} />
    )

    await waitFor(() => expect(rowTitles()).toContain('lazy-async'))
    expect(document.querySelector('.rst__loadingHandle')).toBeNull()
  })

  it('applies children returned synchronously', async () => {
    const children = vi.fn(() => [{ title: 'sync' }])
    render(
      <Controlled initial={[{ title: 'lazy', expanded: true, children }]} />
    )

    await waitFor(() => expect(rowTitles()).toContain('sync'))
  })

  it('leaves the node alone when the promise resolves to nothing', async () => {
    // Only reachable from JavaScript — the signature requires `TreeItem[]`. It
    // must not write `children: undefined` and drop the loader.
    const children = vi.fn(async () => undefined as unknown as TreeItem[])
    render(
      <Controlled initial={[{ title: 'lazy', expanded: true, children }]} />
    )

    await waitFor(() => expect(children).toHaveBeenCalled())
    await act(async () => {
      await Promise.resolve()
    })
    expect(rowTitles()).toEqual(['lazy'])
    expect(document.querySelector('.rst__loadingHandle')).not.toBeNull()
  })
})

describe('SortableTreeWithoutDndContext', () => {
  it('renders nothing outside a react-dnd provider', () => {
    const { container } = render(
      sized(
        <SortableTreeWithoutDndContext
          treeData={basicTree()}
          onChange={() => {}}
        />
      )
    )
    expect(container.querySelector('.rst__tree')).toBeNull()
  })

  it('renders inside an existing provider', async () => {
    const { DndProvider } = await import('@nosferatu500/react-dnd')
    const { HTML5Backend } =
      await import('@nosferatu500/react-dnd-html5-backend')
    render(
      <DndProvider backend={HTML5Backend}>
        {sized(
          <SortableTreeWithoutDndContext
            treeData={basicTree()}
            onChange={() => {}}
          />
        )}
      </DndProvider>
    )
    expect(rowTitles()).toEqual(['a', 'a1', 'a2', 'b', 'c'])
  })
})

describe('tree ids', () => {
  it('gives each mounted tree a distinct id', () => {
    render(
      <>
        {sized(
          <SortableTree treeData={[{ title: 'x' }]} onChange={() => {}} />
        )}
        {sized(
          <SortableTree treeData={[{ title: 'y' }]} onChange={() => {}} />
        )}
      </>
    )
    // Two independent trees render independently rather than sharing state.
    expect(rowTitles()).toEqual(['x', 'y'])
  })
})

describe('render stability', () => {
  /**
   * Counts how many times a node renderer instance mounts. Row components
   * should be re-rendered, not remounted, when the parent re-renders.
   */
  const makeCountingRenderer = () => {
    const mounts = { count: 0 }
    const Renderer = ({ node }: { node: TreeItem }) => {
      React.useEffect(() => {
        mounts.count += 1
      }, [])
      return <div className="rst__rowTitle">{String(node.title)}</div>
    }
    return { mounts, Renderer }
  }

  /**
   * Regression test for the v5 remount bug.
   *
   * `mergedProps = useMemo(..., [props])` could never hit across parent
   * renders, and the staleness cascaded into component *identity*:
   * `canNodeHaveChildren` → `treeNodeRenderer` was a fresh component type every
   * render, so React tore down and rebuilt every row — and every registered
   * drop target with it — on each parent render.
   */
  it('does not remount rows when the parent re-renders', () => {
    const { mounts, Renderer } = makeCountingRenderer()
    const data = [{ title: 'a' }, { title: 'b' }]
    const Wrapper = ({ tick }: { tick: number }) =>
      sized(
        <SortableTree
          treeData={data}
          onChange={() => {}}
          nodeContentRenderer={Renderer}
          data-tick={tick}
        />
      )

    const { rerender } = render(<Wrapper tick={0} />)
    const afterFirst = mounts.count
    expect(afterFirst).toBe(2)

    act(() => rerender(<Wrapper tick={1} />))

    expect(mounts.count).toBe(afterFirst)
  })

  // Inline callbacks are the common case — `onChange={d => setData(d)}` is what
  // the README shows — and used to be the worst case, because every one of them
  // was a fresh reference feeding the memo chain that produced the row
  // component types.
  it('does not remount rows when every callback prop is an inline arrow', () => {
    const { mounts, Renderer } = makeCountingRenderer()
    const data = [{ title: 'a' }, { title: 'b' }]
    const Wrapper = ({ tick }: { tick: number }) =>
      sized(
        <SortableTree
          treeData={data}
          onChange={() => {}}
          onMoveNode={() => {}}
          onVisibilityToggle={() => {}}
          onDragStateChanged={() => {}}
          canDrop={() => true}
          canNodeHaveChildren={() => true}
          nodeContentRenderer={Renderer}
          data-tick={tick}
        />
      )

    const { rerender } = render(<Wrapper tick={0} />)
    const afterFirst = mounts.count

    act(() => rerender(<Wrapper tick={1} />))
    act(() => rerender(<Wrapper tick={2} />))

    expect(mounts.count).toBe(afterFirst)
  })

  it('does not remount rows when the tree state changes', async () => {
    const user = userEvent.setup()
    const { mounts, Renderer } = makeCountingRenderer()
    render(<Controlled nodeContentRenderer={Renderer} />)

    const mountsBefore = mounts.count
    // Toggling calls onChange, which re-renders the parent with new treeData —
    // the exact cycle that used to rebuild every row.
    await user.click(toggleButton('a')!)

    // 'a1' and 'a2' unmount because they are genuinely hidden now; nothing
    // should have been torn down and rebuilt in place.
    expect(mounts.count).toBe(mountsBefore)
  })

  it('renders the same rows after a parent re-render', () => {
    const data = [{ title: 'a' }, { title: 'b' }]
    const Wrapper = ({ tick }: { tick: number }) =>
      sized(
        <SortableTree treeData={data} onChange={() => {}} data-tick={tick} />
      )

    const { rerender } = render(<Wrapper tick={0} />)
    rerender(<Wrapper tick={1} />)

    expect(rowTitles()).toEqual(['a', 'b'])
  })

  /*
   * Rows are memoized, and these are what say so.
   *
   * `React.memo` was tried once directly on `TreeNode` and silently did nothing:
   * a row is `<TreeNodeRenderer><NodeContentRenderer/></TreeNodeRenderer>`, so
   * its `children` was a fresh element every render and the shallow comparison
   * could never pass. The boundary is now `TreeRow`, around the whole
   * composition. Both tests below pass trivially without a memo boundary only if
   * you count wrongly — they count *renders*, not mounts, which is exactly the
   * distinction the earlier attempt got away with blurring.
   *
   * Counting in the render body is safe here because `npm test` runs against
   * `src/`, which the React Compiler never sees.
   */
  const makeRenderCounter = () => {
    const renders: string[] = []
    const Renderer = ({ node }: { node: TreeItem }) => {
      renders.push(String(node.title))
      return <div className="rst__rowTitle">{String(node.title)}</div>
    }
    return { renders, Renderer }
  }

  it('does not re-render any row when the parent re-renders with the same data', () => {
    const { renders, Renderer } = makeRenderCounter()
    const data = [{ title: 'a' }, { title: 'b' }, { title: 'c' }]
    const Wrapper = ({ tick }: { tick: number }) =>
      sized(
        <SortableTree
          treeData={data}
          onChange={() => {}}
          nodeContentRenderer={Renderer}
          data-tick={tick}
        />
      )

    const { rerender } = render(<Wrapper tick={0} />)
    renders.length = 0

    act(() => rerender(<Wrapper tick={1} />))

    expect(renders).toEqual([])
  })

  it('re-renders only the two rows whose active state changed on a focus move', async () => {
    const user = userEvent.setup()
    const { renders, Renderer } = makeRenderCounter()
    render(
      <Controlled
        initial={[{ title: 'a' }, { title: 'b' }, { title: 'c' }]}
        nodeContentRenderer={Renderer}
      />
    )

    const rows = document.querySelectorAll<HTMLElement>('[role="treeitem"]')
    act(() => rows[0]!.focus())
    renders.length = 0

    await user.keyboard('{ArrowDown}')

    // The roving tabindex moved from 'a' to 'b'. Nothing about 'c' changed, and
    // it used to re-render anyway — once per keypress, for every visible row.
    expect(
      [...new Set(renders)].toSorted((a, b) => a.localeCompare(b))
    ).toEqual(['a', 'b'])
  })
})

describe('row identity', () => {
  /**
   * Renders `title@instance`, where `instance` is state owned by the row's React
   * instance. If React hands one node's row instance to a different node, the
   * number stays with the screen position while the title moves — and so would
   * an open inline editor, a checkbox, or focus.
   *
   * The default `getNodeKey` is `({ treeIndex }) => treeIndex`, which is
   * positional, so rows are keyed by node identity instead.
   */
  let instances = 0
  const InstanceRenderer = ({ node }: { node: TreeItem }) => {
    const [id] = useState(() => ++instances)
    return <div className="rst__rowTitle">{`${String(node.title)}@${id}`}</div>
  }

  const labels = () =>
    [...document.querySelectorAll('.rst__rowTitle')].map((el) => el.textContent)

  //  a (expanded) → a1
  //  b
  //  c (collapsed) → c1
  const fixture = (): TreeItem[] => [
    {
      id: 'a',
      title: 'a',
      expanded: true,
      children: [{ id: 'a1', title: 'a1' }],
    },
    { id: 'b', title: 'b' },
    { id: 'c', title: 'c', children: [{ id: 'c1', title: 'c1' }] },
  ]

  /** Renders the tree and hands back a setter, like a controlled consumer. */
  const mount = (props: Record<string, unknown> = {}) => {
    instances = 0
    const initial = fixture()
    let current = initial
    let setData: (next: TreeItem[]) => void = () => {}
    const Harness = () => {
      const [treeData, setTreeData] = useState<TreeItem[]>(initial)
      // Published from an effect rather than during render: reassigning an outer
      // binding while rendering is a side effect (`react-hooks/globals`).
      React.useEffect(() => {
        current = treeData
        setData = setTreeData
      }, [treeData])
      return sized(
        <SortableTree
          treeData={treeData}
          onChange={setTreeData}
          nodeContentRenderer={InstanceRenderer}
          {...props}
        />
      )
    }
    render(<Harness />)
    return {
      tree: () => current,
      change: (next: TreeItem[]) => act(() => setData(next)),
    }
  }

  it('keeps a row with its node across a reorder', () => {
    const t = mount()
    expect(labels()).toEqual(['a@1', 'a1@2', 'b@3', 'c@4'])

    // What a drop does: the same node objects, in a new order.
    const [a, b, c] = t.tree()
    t.change([c!, a!, b!])

    // Positional keys used to produce `c@1, a@2, a1@3, b@4` — every row wearing
    // its neighbour's state.
    expect(labels()).toEqual(['c@4', 'a@1', 'a1@2', 'b@3'])
  })

  it('leaves the rows below alone when a node expands', () => {
    const t = mount()
    expect(labels()).toEqual(['a@1', 'a1@2', 'b@3', 'c@4'])

    // Expanding 'c' the way the toggle button does.
    t.change(
      changeNodeAtPath({
        treeData: t.tree(),
        path: [3],
        getNodeKey: defaultGetNodeKey,
        newNode: ({ node }) => ({ ...node, expanded: true }),
      })
    )

    // Only the revealed row is new. Positional keys used to renumber every row
    // from the insertion point down.
    expect(labels()).toEqual(['a@1', 'a1@2', 'b@3', 'c@4', 'c1@5'])
  })

  it('keeps row instances when a node is edited through changeNodeAtPath', () => {
    const t = mount()

    t.change(
      changeNodeAtPath({
        treeData: t.tree(),
        path: [2],
        getNodeKey: defaultGetNodeKey,
        newNode: ({ node }) => ({ ...node, title: 'B!' }),
      })
    )

    expect(labels()).toEqual(['a@1', 'a1@2', 'B!@3', 'c@4'])
  })

  it('honours a caller-supplied getNodeKey instead of node identity', () => {
    const byId = ({ node }: TreeNode) => String(node['id'])
    const t = mount({ getNodeKey: byId })
    expect(labels()).toEqual(['a@1', 'a1@2', 'b@3', 'c@4'])

    // Fresh objects carrying the same ids. A supplied key is a promise that it
    // is stable, so rows are matched by it and keep their instances — behaviour
    // that predates keying by identity and must not change.
    t.change(fixture())

    expect(labels()).toEqual(['a@1', 'a1@2', 'b@3', 'c@4'])
  })

  it('rebuilds rows when the tree is replaced wholesale under the default key', () => {
    const t = mount()
    expect(labels()).toEqual(['a@1', 'a1@2', 'b@3', 'c@4'])

    // New objects, no ids the tree can match on: every row is genuinely new.
    // Callers who replace their tree this way and want row state preserved
    // should pass a `getNodeKey` — see the test above.
    t.change(fixture())

    expect(labels()).toEqual(['a@5', 'a1@6', 'b@7', 'c@8'])
  })
})
