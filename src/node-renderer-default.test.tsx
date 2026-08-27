import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import NodeRendererDefault, {
  type NodeRendererProps,
} from './node-renderer-default'
import type { TreeItem } from './types'

/*
 * The default node renderer, rendered directly.
 *
 * The component tests reach it through a whole tree, which covers the common path
 * but cannot set the drag-and-drop props independently: `isDragging`, `didDrop`,
 * `isOver`, `canDrop`, `isSettling` and `draggedNode` are all supplied by the
 * wrappers mid-gesture. Driving it straight is how the states it renders for those
 * get exercised at all.
 */

const noopConnector = () => {}

const props = (
  overrides: Partial<NodeRendererProps> & { node: TreeItem }
): NodeRendererProps => ({
  path: [0],
  treeIndex: 0,
  listIndex: 0,
  lowerSiblingCounts: [0],
  isSearchMatch: false,
  isSearchFocus: false,
  canDrag: true,
  scaffoldBlockPxWidth: 44,
  treeId: 'rst__test',
  rowDirection: 'ltr',
  connectDragPreview: noopConnector,
  connectDragSource: noopConnector,
  startDrag: () => {},
  endDrag: () => {},
  isDragging: false,
  didDrop: false,
  isOver: false,
  ...overrides,
})

const renderNode = (
  overrides: Partial<NodeRendererProps> & { node: TreeItem }
) => render(<NodeRendererDefault {...props(overrides)} />)

const row = () => document.querySelector('.rst__row')!
const classes = () => [...row().classList]

describe('NodeRendererDefault', () => {
  describe('title and subtitle', () => {
    it('renders the node title', () => {
      renderNode({ node: { title: 'Roadmap' } })
      expect(document.querySelector('.rst__rowTitle')?.textContent).toBe(
        'Roadmap'
      )
    })

    it('lets the title prop override the node title', () => {
      renderNode({ node: { title: 'from node' }, title: 'from prop' })
      expect(document.querySelector('.rst__rowTitle')?.textContent).toBe(
        'from prop'
      )
    })

    it('calls a function title with the node position', () => {
      const title = vi.fn(() => <b>rendered</b>)
      renderNode({ node: { title }, path: [1, 2], treeIndex: 5 })
      expect(document.querySelector('.rst__rowTitle')?.textContent).toBe(
        'rendered'
      )
      expect(title).toHaveBeenCalledWith(
        expect.objectContaining({ path: [1, 2], treeIndex: 5 })
      )
    })

    it('marks a title that has a subtitle beneath it', () => {
      renderNode({ node: { title: 'a', subtitle: 'b' } })
      expect(
        document
          .querySelector('.rst__rowTitle')
          ?.classList.contains('rst__rowTitleWithSubtitle')
      ).toBe(true)
      expect(document.querySelector('.rst__rowSubtitle')?.textContent).toBe('b')
    })

    it('omits the subtitle element when there is none', () => {
      renderNode({ node: { title: 'a' } })
      expect(document.querySelector('.rst__rowSubtitle')).toBeNull()
    })
  })

  describe('the drag handle', () => {
    it('is rendered when the row can be dragged', () => {
      renderNode({ node: { title: 'a' }, canDrag: true })
      const handle = document.querySelector('.rst__moveHandle')
      expect(handle).not.toBeNull()
      // Named for the backend, which describes a source by its aria-label.
      expect(handle?.getAttribute('aria-label')).toBe('Drag a')
    })

    it('is absent when the row cannot be dragged, and the row says so', () => {
      renderNode({ node: { title: 'a' }, canDrag: false })
      expect(document.querySelector('.rst__moveHandle')).toBeNull()
      expect(
        document
          .querySelector('.rst__rowContents')
          ?.classList.contains('rst__rowContentsDragDisabled')
      ).toBe(true)
    })

    it('falls back to a generic name when the title is not a plain string', () => {
      renderNode({ node: { title: <b>rich</b> } })
      expect(
        document.querySelector('.rst__moveHandle')?.getAttribute('aria-label')
      ).toBe('Drag item')
    })

    it('holds the tab stop only when the row is active', () => {
      const { unmount } = renderNode({
        node: { title: 'a' },
        isActiveRow: true,
      })
      expect(
        document.querySelector<HTMLElement>('.rst__moveHandle')?.tabIndex
      ).toBe(0)
      unmount()

      renderNode({ node: { title: 'a' }, isActiveRow: false })
      expect(
        document.querySelector<HTMLElement>('.rst__moveHandle')?.tabIndex
      ).toBe(-1)
    })

    it('becomes a spinner while an expanded node loads its children', () => {
      // The one place the handle is replaced rather than styled: a lazy node that
      // has been expanded has no children to show yet.
      renderNode({
        node: {
          title: 'a',
          expanded: true,
          children: () => Promise.resolve([]),
        },
      })
      expect(document.querySelector('.rst__loadingHandle')).not.toBeNull()
      expect(document.querySelector('.rst__moveHandle')).toBeNull()
    })

    it('stays a handle for a collapsed lazy node', () => {
      renderNode({
        node: {
          title: 'a',
          expanded: false,
          children: () => Promise.resolve([]),
        },
      })
      expect(document.querySelector('.rst__loadingHandle')).toBeNull()
      expect(document.querySelector('.rst__moveHandle')).not.toBeNull()
    })
  })

  describe('drag and drop state', () => {
    it('shows a landing pad while dragging, before the drop', () => {
      renderNode({
        node: { title: 'a' },
        isDragging: true,
        didDrop: false,
        canDrop: true,
      })
      expect(classes()).toContain('rst__rowLandingPad')
      expect(classes()).not.toContain('rst__rowCancelPad')
    })

    it('shows a cancel pad when the hovered position refuses the drop', () => {
      renderNode({
        node: { title: 'a' },
        isDragging: true,
        didDrop: false,
        canDrop: false,
      })
      expect(classes()).toContain('rst__rowLandingPad')
      expect(classes()).toContain('rst__rowCancelPad')
    })

    it('shows no pad once the drop has happened', () => {
      renderNode({ node: { title: 'a' }, isDragging: true, didDrop: true })
      expect(classes()).not.toContain('rst__rowLandingPad')
    })

    it('marks a row whose asynchronous onDrop is still settling', () => {
      renderNode({ node: { title: 'a' }, isSettling: true })
      expect(classes()).toContain('rst__rowSettling')
      expect(row().getAttribute('aria-busy')).toBe('true')
    })

    it('emits no aria-busy when nothing is settling', () => {
      renderNode({ node: { title: 'a' }, isSettling: false })
      expect(row().getAttribute('aria-busy')).toBeNull()
    })

    it('dims a descendant of the dragged node', () => {
      // Reachable only by supplying `draggedNode`, which the tree does not
      // currently do — so this pins the renderer's half of a path that is dead
      // from above. See the note in `tree-node.tsx`.
      const child: TreeItem = { title: 'child' }
      const dragged: TreeItem = { title: 'parent', children: [child] }
      renderNode({ node: child, draggedNode: dragged })
      expect(row().getAttribute('style')).toContain('opacity: 0.5')
    })

    it('leaves an unrelated row undimmed', () => {
      const dragged: TreeItem = {
        title: 'parent',
        children: [{ title: 'child' }],
      }
      renderNode({ node: { title: 'elsewhere' }, draggedNode: dragged })
      expect(row().getAttribute('style')).toContain('opacity: 1')
    })
  })

  describe('search highlighting', () => {
    it('marks a match and a focused match separately', () => {
      const { unmount } = renderNode({
        node: { title: 'a' },
        isSearchMatch: true,
      })
      expect(classes()).toContain('rst__rowSearchMatch')
      expect(classes()).not.toContain('rst__rowSearchFocus')
      unmount()

      renderNode({
        node: { title: 'a' },
        isSearchMatch: true,
        isSearchFocus: true,
      })
      expect(classes()).toContain('rst__rowSearchFocus')
    })
  })

  describe('the expand and collapse toggle', () => {
    it('is absent without a toggle callback', () => {
      renderNode({ node: { title: 'a', children: [{ title: 'b' }] } })
      expect(
        document.querySelector('.rst__expandButton, .rst__collapseButton')
      ).toBeNull()
    })

    it('is absent for a node with no children', () => {
      renderNode({ node: { title: 'a' }, toggleChildrenVisibility: () => {} })
      expect(
        document.querySelector('.rst__expandButton, .rst__collapseButton')
      ).toBeNull()
    })

    it('labels itself by what pressing it would do', () => {
      const { unmount } = renderNode({
        node: { title: 'a', children: [{ title: 'b' }], expanded: true },
        toggleChildrenVisibility: () => {},
      })
      expect(
        document
          .querySelector('.rst__collapseButton')
          ?.getAttribute('aria-label')
      ).toBe('Collapse')
      unmount()

      renderNode({
        node: { title: 'a', children: [{ title: 'b' }], expanded: false },
        toggleChildrenVisibility: () => {},
      })
      expect(
        document.querySelector('.rst__expandButton')?.getAttribute('aria-label')
      ).toBe('Expand')
    })

    it('reports the node it belongs to when pressed', async () => {
      const user = userEvent.setup()
      const toggleChildrenVisibility = vi.fn()
      const node: TreeItem = { title: 'a', children: [{ title: 'b' }] }
      renderNode({ node, toggleChildrenVisibility, path: [3], treeIndex: 4 })

      await user.click(document.querySelector('.rst__expandButton')!)

      expect(toggleChildrenVisibility).toHaveBeenCalledWith({
        node,
        path: [3],
        treeIndex: 4,
      })
    })

    it('appears for a lazy node whose children have not loaded', () => {
      // `children` is a function, so there is nothing to count — but there will
      // be, and the row has to offer a way to ask for it.
      renderNode({
        node: { title: 'a', children: () => Promise.resolve([]) },
        toggleChildrenVisibility: () => {},
      })
      expect(document.querySelector('.rst__expandButton')).not.toBeNull()
    })
  })

  describe('toolbar and layout', () => {
    it('renders each button in its own slot', () => {
      renderNode({
        node: { title: 'a' },
        buttons: [
          <button key="1" type="button">
            one
          </button>,
          <button key="2" type="button">
            two
          </button>,
        ],
      })
      expect(document.querySelectorAll('.rst__toolbarButton')).toHaveLength(2)
    })

    it('adds the rtl class throughout when the direction is rtl', () => {
      renderNode({ node: { title: 'a' }, rowDirection: 'rtl' })
      expect(classes()).toContain('rst__rtl')
      expect(
        document
          .querySelector('.rst__rowWrapper')
          ?.classList.contains('rst__rtl')
      ).toBe(true)
    })

    it('passes a custom className and style through to the row', () => {
      renderNode({
        node: { title: 'a' },
        className: 'mine',
        style: { color: 'rgb(1, 2, 3)' },
      })
      expect(classes()).toContain('mine')
      expect(row().getAttribute('style')).toContain('color: rgb(1, 2, 3)')
    })
  })
})
