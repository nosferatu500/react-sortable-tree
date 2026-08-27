import { describe, expect, it } from 'vitest'
import { slideRows } from './generic-utils'

/*
 * `slideRows` is what draws the drag preview: `rows` is the flattened row list and
 * this moves a node's rows — the node plus its descendants — to where they would
 * land, so the tree renders the result of the drop before it happens.
 *
 * Worth pinning despite being four lines. The indices are the subtle part: the
 * insertion point is an index into the list *after* the moved rows are taken out,
 * not into the original, which is why moving a row down by one is a no-op.
 */
const ROWS = ['a', 'b', 'c', 'd', 'e']

describe('slideRows', () => {
  it('moves a row down to the given index', () => {
    expect(slideRows(ROWS, 0, 2)).toEqual(['b', 'c', 'a', 'd', 'e'])
  })

  it('moves a row up to the given index', () => {
    expect(slideRows(ROWS, 4, 1)).toEqual(['a', 'e', 'b', 'c', 'd'])
  })

  it('is a no-op when the row is already there', () => {
    expect(slideRows(ROWS, 2, 2)).toEqual(ROWS)
  })

  it('moves a whole block, keeping its internal order', () => {
    // A dragged node travels with its descendants, so `count` is 1 + that many.
    expect(slideRows(ROWS, 0, 2, 2)).toEqual(['c', 'd', 'a', 'b', 'e'])
    expect(slideRows(ROWS, 3, 0, 2)).toEqual(['d', 'e', 'a', 'b', 'c'])
  })

  it('clamps an index past the end rather than leaving holes', () => {
    // `toSpliced` past the end appends, which is what a drop below the last row
    // needs — and never produces a sparse array.
    expect(slideRows(ROWS, 0, 9)).toEqual(['b', 'c', 'd', 'e', 'a'])
  })

  it('treats the target index as an index into the list without the moved rows', () => {
    // The distinction that makes moving down by one a no-op: 'b' is removed
    // first, so index 1 is where it already was.
    expect(slideRows(ROWS, 1, 1)).toEqual(ROWS)
    expect(slideRows(ROWS, 1, 2)).toEqual(['a', 'c', 'b', 'd', 'e'])
  })

  it('does not mutate its input', () => {
    const rows = [...ROWS]
    slideRows(rows, 0, 3, 2)
    expect(rows).toEqual(ROWS)
  })

  it('handles an empty list and a single row', () => {
    expect(slideRows([], 0, 0)).toEqual([])
    expect(slideRows(['only'], 0, 0)).toEqual(['only'])
  })
})
