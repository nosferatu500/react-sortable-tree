import { describe, expect, it } from 'vitest'
import { at, childAt } from '../test-helpers'
import type { TreeItem } from '../types'
import {
  cloneWithIdentity,
  inheritIdentity,
  rowIdentity,
} from './node-identity'
import {
  addNodeUnderParent,
  changeNodeAtPath,
  insertNode,
  map,
  removeNodeAtPath,
} from './tree-data-utils'

/**
 * Row identity is what React reconciles rows by when the caller has not supplied
 * a `getNodeKey` (see `node-identity.ts`). It only holds up if the tree helpers
 * carry it across their clone-on-write updates, which is what these pin.
 */

const keyById = ({ node }: { node: TreeItem }) => node['id'] as string

const sample = (): [TreeItem, TreeItem, TreeItem] => [
  {
    id: 'a',
    title: 'a',
    expanded: true,
    children: [{ id: 'a1', title: 'a1' }],
  },
  { id: 'b', title: 'b' },
  { id: 'c', title: 'c' },
]

describe('rowIdentity', () => {
  it('is stable per node object and distinct between nodes', () => {
    const node: TreeItem = { title: 'x' }
    const other: TreeItem = { title: 'x' }
    expect(rowIdentity(node)).toBe(rowIdentity(node))
    expect(rowIdentity(other)).not.toBe(rowIdentity(node))
  })

  it('does not follow a plain copy', () => {
    const node: TreeItem = { title: 'x' }
    expect(rowIdentity({ ...node })).not.toBe(rowIdentity(node))
  })
})

describe('cloneWithIdentity / inheritIdentity', () => {
  it('keeps the identity across a patch', () => {
    const node: TreeItem = { title: 'x' }
    const id = rowIdentity(node)
    const clone = cloneWithIdentity(node, { expanded: true })
    expect(clone).not.toBe(node)
    expect(clone.expanded).toBe(true)
    expect(rowIdentity(clone)).toBe(id)
  })

  it('is a no-op when the node is its own replacement', () => {
    const node: TreeItem = { title: 'x' }
    expect(inheritIdentity(node, node)).toBe(node)
  })

  it('leaves the replacement with its own identity when the source has none', () => {
    // Nothing has rendered `previous`, so there is no identity to carry.
    const previous: TreeItem = { title: 'x' }
    const next: TreeItem = { title: 'y' }
    const id = rowIdentity(inheritIdentity(previous, next))
    expect(id).not.toBe(rowIdentity(previous))
  })
})

describe('the tree helpers carry row identity', () => {
  it('changeNodeAtPath: the edited node and its ancestors keep theirs', () => {
    const treeData = sample()
    const [a] = treeData
    const a1 = childAt(a, 0)
    const ids = { a: rowIdentity(a), a1: rowIdentity(a1) }

    const next = changeNodeAtPath({
      treeData,
      path: ['a', 'a1'],
      getNodeKey: keyById,
      newNode: ({ node }) => ({ ...node, title: 'a1!' }),
    })

    // `a` is cloned because it is on the path; `a1` is replaced by the callback.
    const nextA = at(next, 0)
    const nextA1 = childAt(nextA, 0)
    expect(nextA).not.toBe(a)
    expect(nextA1).not.toBe(a1)
    expect(rowIdentity(nextA)).toBe(ids.a)
    expect(rowIdentity(nextA1)).toBe(ids.a1)
  })

  it('changeNodeAtPath: untouched siblings keep theirs by staying the same object', () => {
    const treeData = sample()
    const ids = treeData.map((node) => rowIdentity(node))

    const next = changeNodeAtPath({
      treeData,
      path: ['a'],
      getNodeKey: keyById,
      newNode: ({ node }) => ({ ...node, expanded: false }),
    })

    expect(next.map((node) => rowIdentity(node))).toEqual(ids)
  })

  it('removeNodeAtPath: the surviving ancestor keeps its identity', () => {
    const treeData = sample()
    const [a] = treeData
    const idA = rowIdentity(a)

    const next = removeNodeAtPath({
      treeData,
      path: ['a', 'a1'],
      getNodeKey: keyById,
    })

    expect(rowIdentity(at(next, 0))).toBe(idA)
  })

  it('insertNode: the parent it expands keeps its identity', () => {
    const treeData = sample()
    const [a] = treeData
    const idA = rowIdentity(a)

    const { treeData: next } = insertNode({
      treeData,
      newNode: { id: 'new', title: 'new' },
      depth: 1,
      minimumTreeIndex: 1,
      getNodeKey: keyById,
      expandParent: true,
    })

    expect(rowIdentity(at(next, 0))).toBe(idA)
  })

  it('addNodeUnderParent: the parent keeps its identity', () => {
    const treeData = sample()
    const [a] = treeData
    const idA = rowIdentity(a)

    const { treeData: next } = addNodeUnderParent({
      treeData,
      newNode: { id: 'new', title: 'new' },
      parentKey: 'a',
      getNodeKey: keyById,
    })

    expect(rowIdentity(at(next, 0))).toBe(idA)
  })

  it('map: transformed nodes keep their identity', () => {
    const treeData = sample()
    const ids = treeData.map((node) => rowIdentity(node))

    const next = map({
      treeData,
      getNodeKey: keyById,
      callback: ({ node }) => ({ ...node, seen: true }),
      ignoreCollapsed: false,
    })

    expect(next.map((node) => rowIdentity(node))).toEqual(ids)
    expect(at(next, 0)['seen']).toBe(true)
  })
})
