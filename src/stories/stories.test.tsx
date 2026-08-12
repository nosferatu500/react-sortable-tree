import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it } from 'vitest'
import KeyboardNavigation from './accessibility/keyboard-navigation'
import AsyncDrop from './advanced/async-drop'
import LargeTree from './advanced/large-tree'
import LazyChildren from './basics/lazy-children'

/**
 * Smoke tests for the stories added alongside the v6 features, so a broken
 * example fails here rather than in a Storybook tab nobody opened. The rest of
 * the stories are covered by `npm run build-storybook`.
 */

const rowTitles = () =>
  [...document.querySelectorAll('.rst__rowTitle')].map((el) => el.textContent)

/** The expand/collapse button of the row whose title starts with `prefix`. */
const toggleFor = (prefix: string) => {
  const label = [...document.querySelectorAll('.rst__rowTitle')].find((el) =>
    el.textContent?.startsWith(prefix)
  )
  const button = label
    ?.closest('.rst__node')
    ?.querySelector<HTMLButtonElement>(
      '.rst__expandButton, .rst__collapseButton'
    )
  if (!button) throw new Error(`no toggle for a row starting "${prefix}"`)
  return button
}

describe('Basics/LazyChildren story', () => {
  it('loads children from the returned promise and reports failures', async () => {
    render(<LazyChildren />)
    expect(rowTitles()).toContain('Reports (expand me)')

    // Reports resolves; Archive rejects and the loader substitutes a row.
    await userEvent.click(toggleFor('Reports'))
    await waitFor(() => expect(rowTitles()).toContain('reports/Q1.pdf'), {
      timeout: 3000,
    })

    await userEvent.click(toggleFor('Archive'))
    await waitFor(
      () =>
        expect(rowTitles()).toContain(
          'Could not load archive — collapse and expand to retry'
        ),
      { timeout: 3000 }
    )
  })
})

describe('Accessibility/KeyboardNavigation story', () => {
  it('names the tree and moves focus with the arrow keys', async () => {
    render(<KeyboardNavigation />)
    const tree = document.querySelector('[role="tree"]')
    expect(tree?.getAttribute('aria-labelledby')).toBe('rst-a11y-heading')
    expect(document.querySelector('#rst-a11y-heading')?.textContent).toBe(
      'Project files'
    )

    const rows = document.querySelectorAll<HTMLElement>('[role="treeitem"]')
    rows[0]!.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(rows[1])
  })

  it('stops handling the arrow keys when the toggle is cleared', async () => {
    render(<KeyboardNavigation />)
    await userEvent.click(screen.getByLabelText(/keyboardNavigation/))

    const rows = document.querySelectorAll<HTMLElement>('[role="treeitem"]')
    rows[0]!.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(rows[0])
  })
})

describe('Advanced/AsyncDrop story', () => {
  /*
   * Renders and toggles only. The story uses `SortableTree`, so its drag and drop
   * runs on the HTML5 backend, which cannot be driven from jsdom — the settling,
   * revert and announcement behaviour is covered against the TestBackend in
   * `utils/dnd-manager.test.tsx` instead.
   */
  it('renders the tree and the failure toggle', async () => {
    render(<AsyncDrop />)

    expect(rowTitles()).toEqual([
      'Inbox',
      'Projects',
      'Roadmap',
      'Budget',
      'Archive',
    ])
    expect(screen.getByText('Drag a row to save a move.')).toBeDefined()

    const fail = screen.getByLabelText(/make the save fail/)
    expect((fail as HTMLInputElement).checked).toBe(false)
    await userEvent.click(fail)
    expect((fail as HTMLInputElement).checked).toBe(true)
  })
})

describe('Advanced/LargeTree story', () => {
  it('virtualizes 10,000 nodes down to a handful of rows', async () => {
    render(<LargeTree />)
    await userEvent.click(screen.getByRole('button', { name: /count rows/i }))

    const readout = await screen.findByText(/of 10,000 rows rendered/)
    const shown = Number(/^(\d+)/.exec(readout.textContent ?? '')?.[1])
    expect(shown).toBeGreaterThan(0)
    expect(shown).toBeLessThan(100)
  })
})
