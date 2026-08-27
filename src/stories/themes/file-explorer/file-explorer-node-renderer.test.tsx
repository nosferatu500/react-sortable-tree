import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { TreeItem } from '../../../types'
import FileExplorerNodeRenderer, {
  type FileExplorerNodeRendererProps,
} from './file-explorer-node-renderer'

/*
 * The file-explorer theme's node renderer.
 *
 * A story rather than shipped code, but it is the worked example of a *custom*
 * `nodeContentRenderer` — the thing the README points at — so it is worth holding
 * to the same contract as the default one. In particular it has to put
 * `isActiveRow` on its drag source, or a tree using this theme grows one tab stop
 * per visible row.
 */

const noopConnector = () => {}

const props = (
  overrides: Partial<FileExplorerNodeRendererProps> & { node: TreeItem }
): FileExplorerNodeRendererProps => ({
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
  overrides: Partial<FileExplorerNodeRendererProps> & { node: TreeItem }
) => render(<FileExplorerNodeRenderer {...props(overrides)} />)

const row = () => document.querySelector('.rst__fe-row')!

describe('FileExplorerNodeRenderer', () => {
  it('renders the title', () => {
    renderNode({ node: { title: 'notes.txt' } })
    expect(document.querySelector('.rst__fe-title')?.textContent).toBe(
      'notes.txt'
    )
  })

  it('treats a node with children as a folder, and one without as a file', () => {
    const { unmount } = renderNode({
      node: { title: 'src', children: [{ title: 'index.ts' }] },
    })
    // The folder icon is the only one that reacts to `expanded`, so its presence
    // is what distinguishes the two.
    expect(document.querySelector('.rst__fe-chevronVisible')).not.toBeNull()
    unmount()

    renderNode({ node: { title: 'index.ts' } })
    expect(document.querySelector('.rst__fe-chevronVisible')).toBeNull()
  })

  it('treats an explicitly marked directory as a folder even with no children', () => {
    renderNode({ node: { title: 'empty', isDirectory: true } })
    expect(document.querySelector('.rst__fe-icon')).not.toBeNull()
  })

  it('shows a chevron for a lazy node whose children have not loaded', () => {
    renderNode({
      node: { title: 'remote', children: () => Promise.resolve([]) },
      toggleChildrenVisibility: () => {},
    })
    expect(document.querySelector('.rst__fe-chevronVisible')).not.toBeNull()
  })

  it('reports the node when the chevron is pressed', async () => {
    const user = userEvent.setup()
    const toggleChildrenVisibility = vi.fn()
    const node: TreeItem = { title: 'src', children: [{ title: 'a' }] }
    renderNode({ node, toggleChildrenVisibility, path: [2], treeIndex: 3 })

    await user.click(document.querySelector('.rst__fe-chevron')!)

    expect(toggleChildrenVisibility).toHaveBeenCalledWith({
      node,
      path: [2],
      treeIndex: 3,
    })
  })

  it('does not call the toggle for a childless node', async () => {
    const user = userEvent.setup()
    const toggleChildrenVisibility = vi.fn()
    renderNode({ node: { title: 'a.txt' }, toggleChildrenVisibility })

    await user.click(document.querySelector('.rst__fe-chevron')!)

    expect(toggleChildrenVisibility).not.toHaveBeenCalled()
  })

  /*
   * This theme drags by the whole row rather than a separate handle, so the drag
   * source is the wrapper the connectors attach to — identified here by its
   * `aria-label`, since the `role` is written by the backend at connect time and
   * there is no provider in a standalone render.
   */
  const dragSource = () => document.querySelector<HTMLElement>('[aria-label]')

  it('puts the roving tab stop on its drag source', () => {
    // The contract a custom renderer has to honour: without this the keyboard
    // backend makes every visible row focusable.
    const { unmount } = renderNode({ node: { title: 'a' }, isActiveRow: true })
    expect(dragSource()?.tabIndex).toBe(0)
    unmount()

    renderNode({ node: { title: 'a' }, isActiveRow: false })
    expect(dragSource()?.tabIndex).toBe(-1)
  })

  it('names its drag source, falling back for a non-string title', () => {
    const { unmount } = renderNode({ node: { title: 'notes.txt' } })
    expect(dragSource()?.getAttribute('aria-label')).toBe('Drag notes.txt')
    unmount()

    renderNode({ node: { title: <b>rich</b> } })
    expect(dragSource()?.getAttribute('aria-label')).toBe('Drag item')
  })

  it('is not draggable at all when canDrag is false', () => {
    // No wrapper, so nothing is focusable and nothing is a drag source.
    renderNode({ node: { title: 'a' }, canDrag: false })
    expect(dragSource()).toBeNull()
  })

  it('marks the landing and cancel pads while dragging', () => {
    const { unmount } = renderNode({
      node: { title: 'a' },
      isDragging: true,
      canDrop: true,
    })
    expect([...row().classList]).toContain('rst__fe-rowLandingPad')
    expect([...row().classList]).not.toContain('rst__fe-rowCancelPad')
    unmount()

    renderNode({ node: { title: 'a' }, isDragging: true, canDrop: false })
    expect([...row().classList]).toContain('rst__fe-rowCancelPad')
  })

  it('marks search matches and the focused match', () => {
    renderNode({
      node: { title: 'a' },
      isSearchMatch: true,
      isSearchFocus: true,
    })
    expect([...row().classList]).toContain('rst__fe-rowSearchMatch')
    expect([...row().classList]).toContain('rst__fe-rowSearchFocus')
  })

  it('renders supplied buttons, and no toolbar without them', () => {
    const { unmount } = renderNode({ node: { title: 'a' } })
    expect(document.querySelector('.rst__fe-toolbar')).toBeNull()
    unmount()

    renderNode({
      node: { title: 'a' },
      buttons: [
        <button key="1" type="button">
          go
        </button>,
      ],
    })
    expect(document.querySelectorAll('.rst__fe-toolbarButton')).toHaveLength(1)
  })

  it('calls a function title with the node position', () => {
    const title = vi.fn(() => <i>x</i>)
    renderNode({ node: { title }, path: [4], treeIndex: 6 })
    expect(title).toHaveBeenCalledWith(
      expect.objectContaining({ path: [4], treeIndex: 6 })
    )
  })
})
