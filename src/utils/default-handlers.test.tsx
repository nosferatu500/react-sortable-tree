import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { TreeItem } from '../types'
import { defaultGetNodeKey, defaultSearchMethod } from './default-handlers'

/*
 * The two handlers the tree falls back on when a consumer supplies neither.
 *
 * `defaultSearchMethod` is the interesting one: `title` and `subtitle` accept a
 * string, a `ReactNode`, or a function of the node, and it has to find text inside
 * all three. The ReactNode path walks children recursively, which nothing else
 * exercised.
 */

const search = (node: TreeItem, searchQuery: string) =>
  defaultSearchMethod({ node, path: [0], treeIndex: 0, searchQuery })

describe('defaultGetNodeKey', () => {
  it('is the tree index, which is why it cannot serve as a React key', () => {
    // Positional by design — see `node-identity.ts` for what the tree uses to key
    // rows instead.
    expect(defaultGetNodeKey({ treeIndex: 0 })).toBe(0)
    expect(defaultGetNodeKey({ treeIndex: 7 })).toBe(7)
  })
})

describe('defaultSearchMethod', () => {
  it('matches a substring of a string title or subtitle', () => {
    expect(search({ title: 'Roadmap' }, 'oadm')).toBe(true)
    expect(search({ title: 'Roadmap' }, 'budget')).toBe(false)
    expect(search({ subtitle: 'Q1 plan' }, 'plan')).toBe(true)
  })

  it('is case sensitive', () => {
    expect(search({ title: 'Roadmap' }, 'roadmap')).toBe(false)
  })

  it('matches either field, so a subtitle hit counts', () => {
    expect(search({ title: 'Roadmap', subtitle: 'Q1' }, 'Q1')).toBe(true)
  })

  it('calls a function title and searches what it returns', () => {
    const title = vi.fn(
      ({ treeIndex }: { treeIndex: number }) => `row ${treeIndex}`
    )
    expect(search({ title }, 'row 0')).toBe(true)
    // Called with the node's own position, which is how a title can depend on it.
    expect(title).toHaveBeenCalledWith(
      expect.objectContaining({ path: [0], treeIndex: 0 })
    )
  })

  it('searches the text inside a ReactNode title', () => {
    expect(search({ title: <b>Roadmap</b> }, 'oadm')).toBe(true)
    expect(search({ title: <b>Roadmap</b> }, 'budget')).toBe(false)
  })

  it('walks nested elements and joins sibling text', () => {
    const title = (
      <span>
        <em>Road</em>
        <em>map</em>
      </span>
    )
    // Joined without a separator, so a query spanning the boundary matches.
    expect(search({ title }, 'Roadmap')).toBe(true)
  })

  it('finds a number rendered as a child', () => {
    expect(search({ title: <b>{42}</b> }, '42')).toBe(true)
  })

  it('reports no match for an element with no children', () => {
    expect(search({ title: <hr /> }, 'anything')).toBe(false)
  })

  it('reports no match for a node with neither field', () => {
    expect(search({}, 'anything')).toBe(false)
  })

  it('never matches a falsy title', () => {
    // `String(null).includes('ul')` would be true, so these are guarded on
    // truthiness rather than on being defined.
    expect(search({ title: null }, 'ul')).toBe(false)
    expect(search({ title: '' }, '')).toBe(false)
    expect(search({ title: 0 }, '0')).toBe(false)
    expect(search({ title: false }, 'als')).toBe(false)
  })
})
