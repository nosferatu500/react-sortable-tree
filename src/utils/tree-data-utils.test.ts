import { describe, expect, it, vi } from 'vitest'
import { at, childAt, childrenOf } from '../test-helpers'
import type {
  GetTreeItemChildrenFn,
  TreeIndex,
  TreeItem,
  TreeNode,
} from '../types'
import { defaultGetNodeKey } from './default-handlers'
import {
  addNodeUnderParent,
  changeNodeAtPath,
  find,
  getDepth,
  getDescendantCount,
  getFlatDataFromTree,
  getNodeAtPath,
  getTreeFromFlatData,
  getVisibleNodeCount,
  getVisibleNodeInfoAtIndex,
  insertNode,
  isDescendant,
  map,
  removeNode,
  removeNodeAtPath,
  toggleExpandedForAll,
  walk,
} from './tree-data-utils'

/** Key nodes by their `id` field, so paths survive reordering. */
const keyById = ({ node }: TreeNode & TreeIndex) => node['id'] as string

/**
 * a (expanded)
 * ├─ a1 (expanded)
 * │  └─ a1a
 * └─ a2
 * b (collapsed — b1 is hidden)
 * └─ b1
 * c
 */
const sample = (): [TreeItem, TreeItem, TreeItem] => [
  {
    id: 'a',
    title: 'a',
    expanded: true,
    children: [
      {
        id: 'a1',
        title: 'a1',
        expanded: true,
        children: [{ id: 'a1a', title: 'a1a' }],
      },
      { id: 'a2', title: 'a2' },
    ],
  },
  { id: 'b', title: 'b', children: [{ id: 'b1', title: 'b1' }] },
  { id: 'c', title: 'c' },
]

describe('getDescendantCount', () => {
  it('counts only visible descendants by default', () => {
    const [a, b, c] = sample()
    expect(getDescendantCount({ node: a })).toBe(3) // a1, a1a, a2
    expect(getDescendantCount({ node: b })).toBe(0) // collapsed
    expect(getDescendantCount({ node: c })).toBe(0) // childless
  })

  it('counts hidden descendants when ignoreCollapsed is false', () => {
    const [a, b] = sample()
    expect(getDescendantCount({ node: a, ignoreCollapsed: false })).toBe(3)
    expect(getDescendantCount({ node: b, ignoreCollapsed: false })).toBe(1)
  })

  it('treats function children as opaque', () => {
    const node: TreeItem = {
      title: 'lazy',
      expanded: true,
      children: (() => {}) as GetTreeItemChildrenFn,
    }
    expect(getDescendantCount({ node })).toBe(0)
  })

  it('handles an expanded node with an empty children array', () => {
    expect(
      getDescendantCount({ node: { title: 'x', expanded: true, children: [] } })
    ).toBe(0)
  })

  it('counts deep chains', () => {
    const deep: TreeItem = {
      title: '1',
      expanded: true,
      children: [
        {
          title: '2',
          expanded: true,
          children: [
            { title: '3', expanded: true, children: [{ title: '4' }] },
          ],
        },
      ],
    }
    expect(getDescendantCount({ node: deep })).toBe(3)
  })

  it('does not mutate the node', () => {
    const [a] = sample()
    const before = structuredClone(a)
    getDescendantCount({ node: a })
    expect(a).toEqual(before)
  })
})

describe('getVisibleNodeCount', () => {
  it('counts visible nodes across the whole forest', () => {
    expect(getVisibleNodeCount({ treeData: sample() })).toBe(6) // a a1 a1a a2 b c
  })

  it('returns 0 for an empty tree', () => {
    expect(getVisibleNodeCount({ treeData: [] })).toBe(0)
  })

  it('ignores children behind a function', () => {
    const treeData: TreeItem[] = [
      {
        title: 'lazy',
        expanded: true,
        children: (() => {}) as GetTreeItemChildrenFn,
      },
    ]
    expect(getVisibleNodeCount({ treeData })).toBe(1)
  })
})

describe('getVisibleNodeInfoAtIndex', () => {
  it('resolves each visible index to its node and path', () => {
    const treeData = sample()
    const infoAt = (index: number) =>
      getVisibleNodeInfoAtIndex({ treeData, index, getNodeKey: keyById })

    expect(infoAt(0)?.node['id']).toBe('a')
    expect(infoAt(1)?.node['id']).toBe('a1')
    expect(infoAt(2)?.node['id']).toBe('a1a')
    expect(infoAt(3)?.node['id']).toBe('a2')
    expect(infoAt(4)?.node['id']).toBe('b') // b1 is collapsed, so it has no index
    expect(infoAt(5)?.node['id']).toBe('c')
    expect(infoAt(2)?.path).toEqual(['a', 'a1', 'a1a'])
  })

  it('reports lowerSiblingCounts per depth', () => {
    const info = getVisibleNodeInfoAtIndex({
      treeData: sample(),
      index: 2,
      getNodeKey: keyById,
    })
    // a has 2 lower siblings (b, c); a1 has 1 (a2); a1a has 0
    expect(info?.lowerSiblingCounts).toEqual([2, 1, 0])
  })

  it('returns null past the end and for an empty tree', () => {
    expect(
      getVisibleNodeInfoAtIndex({
        treeData: sample(),
        index: 99,
        getNodeKey: keyById,
      })
    ).toBeNull()
    expect(
      getVisibleNodeInfoAtIndex({ treeData: [], index: 0, getNodeKey: keyById })
    ).toBeNull()
  })
})

describe('walk', () => {
  it('visits visible nodes depth-first with correct treeIndex and path', () => {
    const seen: Array<[string, number, unknown[]]> = []
    walk({
      treeData: sample(),
      getNodeKey: keyById,
      callback: ({ node, treeIndex, path }) => {
        seen.push([node['id'] as string, treeIndex, path])
      },
    })
    expect(seen.map((s) => s[0])).toEqual(['a', 'a1', 'a1a', 'a2', 'b', 'c'])
    expect(seen.map((s) => s[1])).toEqual([0, 1, 2, 3, 4, 5])
    expect(at(seen, 2)[2]).toEqual(['a', 'a1', 'a1a'])
  })

  it('descends into collapsed nodes when ignoreCollapsed is false', () => {
    const seen: string[] = []
    walk({
      treeData: sample(),
      getNodeKey: keyById,
      ignoreCollapsed: false,
      callback: ({ node }) => {
        seen.push(node['id'] as string)
      },
    })
    expect(seen).toEqual(['a', 'a1', 'a1a', 'a2', 'b', 'b1', 'c'])
  })

  it('exposes parentNode, undefined at the root', () => {
    const parents: Record<string, string | undefined> = {}
    walk({
      treeData: sample(),
      getNodeKey: keyById,
      callback: ({ node, parentNode }) => {
        parents[node['id'] as string] = parentNode?.['id'] as string | undefined
      },
    })
    expect(parents).toEqual({
      a: undefined,
      a1: 'a',
      a1a: 'a1',
      a2: 'a',
      b: undefined,
      c: undefined,
    })
  })

  it('stops early when the callback returns false', () => {
    const seen: string[] = []
    walk({
      treeData: sample(),
      getNodeKey: keyById,
      callback: ({ node }) => {
        seen.push(node['id'] as string)
        return node['id'] === 'a1' ? false : undefined
      },
    })
    expect(seen).toEqual(['a', 'a1'])
  })

  it('is a no-op on an empty tree', () => {
    const callback = vi.fn()
    walk({ treeData: [], getNodeKey: keyById, callback })
    expect(callback).not.toHaveBeenCalled()
  })
})

describe('map', () => {
  it('transforms every visible node and returns a new tree', () => {
    const result = map({
      treeData: sample(),
      getNodeKey: keyById,
      callback: ({ node }) => ({ ...node, title: `${node['title']}!` }),
    })
    expect(at(result, 0)['title']).toBe('a!')
    expect(childAt(result[0], 0)['title']).toBe('a1!')
    expect(at(result, 2)['title']).toBe('c!')
  })

  it('leaves the input untouched', () => {
    const treeData = sample()
    const before = structuredClone(treeData)
    map({
      treeData,
      getNodeKey: keyById,
      callback: ({ node }) => ({ ...node, seen: true }),
    })
    expect(treeData).toEqual(before)
  })

  it('skips collapsed subtrees unless ignoreCollapsed is false', () => {
    const visited: string[] = []
    map({
      treeData: sample(),
      getNodeKey: keyById,
      callback: ({ node }) => {
        visited.push(node['id'] as string)
        return node
      },
    })
    expect(visited).not.toContain('b1')

    const all: string[] = []
    map({
      treeData: sample(),
      getNodeKey: keyById,
      ignoreCollapsed: false,
      callback: ({ node }) => {
        all.push(node['id'] as string)
        return node
      },
    })
    expect(all).toContain('b1')
  })

  it('returns [] for an empty tree', () => {
    expect(
      map({ treeData: [], getNodeKey: keyById, callback: ({ node }) => node })
    ).toEqual([])
  })
})

describe('toggleExpandedForAll', () => {
  it('expands every node including hidden ones', () => {
    const result = toggleExpandedForAll({ treeData: sample() })
    const states: boolean[] = []
    walk({
      treeData: result,
      getNodeKey: keyById,
      ignoreCollapsed: false,
      callback: ({ node }) => {
        states.push(node.expanded === true)
      },
    })
    expect(states.every(Boolean)).toBe(true)
  })

  it('collapses every node when expanded is false', () => {
    const result = toggleExpandedForAll({ treeData: sample(), expanded: false })
    expect(at(result, 0).expanded).toBe(false)
    expect(childAt(result[0], 0).expanded).toBe(false)
  })
})

describe('changeNodeAtPath', () => {
  it('replaces a root node', () => {
    const treeData = sample()
    const result = changeNodeAtPath({
      treeData,
      path: ['c'],
      newNode: { id: 'c', title: 'C!' },
      getNodeKey: keyById,
    })
    expect(at(result, 2)['title']).toBe('C!')
    expect(treeData[2]['title']).toBe('c')
  })

  it('replaces a deeply nested node', () => {
    const result = changeNodeAtPath({
      treeData: sample(),
      path: ['a', 'a1', 'a1a'],
      newNode: { id: 'a1a', title: 'deep!' },
      getNodeKey: keyById,
    })
    const a1 = childAt(result[0], 0)
    expect(childAt(a1, 0)['title']).toBe('deep!')
  })

  it('passes the existing node and its treeIndex to a function newNode', () => {
    const spy = vi.fn(({ node }: { node: TreeItem }) => ({
      ...node,
      touched: true,
    }))
    changeNodeAtPath({
      treeData: sample(),
      path: ['a', 'a2'],
      newNode: spy,
      getNodeKey: keyById,
    })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(at(spy.mock.calls, 0)[0].node['id']).toBe('a2')
    expect((at(spy.mock.calls, 0)[0] as unknown as TreeIndex).treeIndex).toBe(3)
  })

  it('deletes the node when newNode resolves to undefined or null', () => {
    for (const nil of [undefined, null]) {
      const result = changeNodeAtPath({
        treeData: sample(),
        path: ['a', 'a2'],
        newNode: () => nil,
        getNodeKey: keyById,
      })
      expect(childrenOf(result[0]).map((n) => n['id'])).toEqual(['a1'])
    }
  })

  it('does not mutate the input tree', () => {
    const treeData = sample()
    const before = structuredClone(treeData)
    changeNodeAtPath({
      treeData,
      path: ['a', 'a1', 'a1a'],
      newNode: { id: 'a1a', title: 'changed' },
      getNodeKey: keyById,
    })
    expect(treeData).toEqual(before)
  })

  it('preserves object identity of untouched branches (structural sharing)', () => {
    const treeData = sample()
    const result = changeNodeAtPath({
      treeData,
      path: ['a', 'a1', 'a1a'],
      newNode: { id: 'a1a', title: 'changed' },
      getNodeKey: keyById,
    })
    // Siblings and unrelated roots must be the very same objects.
    expect(result[1]).toBe(treeData[1])
    expect(result[2]).toBe(treeData[2])
    expect(childAt(result[0], 1)).toBe(childAt(treeData[0], 1))
    // Nodes along the changed path must be fresh.
    expect(result[0]).not.toBe(treeData[0])
  })

  it('resolves paths with the treeIndex-based default key function', () => {
    const result = changeNodeAtPath({
      treeData: sample(),
      path: [0, 1, 2],
      newNode: { title: 'by index' },
      getNodeKey: defaultGetNodeKey,
    })
    const a1 = childAt(result[0], 0)
    expect(childAt(a1, 0)['title']).toBe('by index')
  })

  it('throws when the path does not resolve', () => {
    expect(() =>
      changeNodeAtPath({
        treeData: sample(),
        path: ['nope'],
        newNode: {},
        getNodeKey: keyById,
      })
    ).toThrow('No node found at the given path.')
  })

  it('throws when the path descends through a childless node', () => {
    expect(() =>
      changeNodeAtPath({
        treeData: sample(),
        path: ['c', 'x'],
        newNode: {},
        getNodeKey: keyById,
      })
    ).toThrow('Path referenced children of node with no children.')
  })

  it('returns [] for an empty tree', () => {
    expect(
      changeNodeAtPath({
        treeData: [],
        path: ['a'],
        newNode: {},
        getNodeKey: keyById,
      })
    ).toEqual([])
  })

  // An empty path addresses the pseudo-root. `dragHover` hits this on every
  // top-level drop (`insertNode(...).path.toSpliced(-1)` is `[]` at depth 0),
  // so it must be a no-op, not a throw.
  it('is a no-op for an empty path', () => {
    const treeData = sample()
    expect(() =>
      changeNodeAtPath({ treeData, path: [], newNode: {}, getNodeKey: keyById })
    ).not.toThrow()
    expect(
      changeNodeAtPath({ treeData, path: [], newNode: {}, getNodeKey: keyById })
    ).toEqual(treeData)
  })

  it('can reach hidden nodes when ignoreCollapsed is false', () => {
    const result = changeNodeAtPath({
      treeData: sample(),
      path: ['b', 'b1'],
      newNode: { id: 'b1', title: 'hidden!' },
      getNodeKey: keyById,
      ignoreCollapsed: false,
    })
    expect(childAt(result[1], 0)['title']).toBe('hidden!')
  })
})

describe('removeNodeAtPath / removeNode', () => {
  it('removes a node and leaves siblings intact', () => {
    const result = removeNodeAtPath({
      treeData: sample(),
      path: ['a', 'a1'],
      getNodeKey: keyById,
    })
    expect(childrenOf(result[0]).map((n) => n['id'])).toEqual(['a2'])
  })

  it('returns the removed node, its treeIndex, and the new tree', () => {
    const result = removeNode({
      treeData: sample(),
      path: ['a', 'a2'],
      getNodeKey: keyById,
    })!
    expect(result.node['id']).toBe('a2')
    expect(result.treeIndex).toBe(3)
    expect(childrenOf(result.treeData[0]).map((n) => n['id'])).toEqual(['a1'])
  })

  it('returns a plain node, not a proxy or draft', () => {
    const result = removeNode({
      treeData: sample(),
      path: ['a', 'a1'],
      getNodeKey: keyById,
    })!
    // Must survive being cloned and re-inserted elsewhere.
    expect(() => structuredClone(result.node)).not.toThrow()
    expect(result.node['id']).toBe('a1')
    expect(childAt(result.node, 0)['id']).toBe('a1a')
  })

  it('returns undefined instead of throwing on a bad path', () => {
    expect(
      removeNode({ treeData: sample(), path: ['nope'], getNodeKey: keyById })
    ).toBeUndefined()
  })

  it('does not mutate the input', () => {
    const treeData = sample()
    const before = structuredClone(treeData)
    removeNode({ treeData, path: ['a', 'a1'], getNodeKey: keyById })
    expect(treeData).toEqual(before)
  })
})

describe('getNodeAtPath', () => {
  it('finds a node and reports its treeIndex', () => {
    const found = getNodeAtPath({
      treeData: sample(),
      path: ['a', 'a1', 'a1a'],
      getNodeKey: keyById,
    })
    expect(found?.node['id']).toBe('a1a')
    expect(found?.treeIndex).toBe(2)
  })

  it('returns a plain node, not a draft', () => {
    const found = getNodeAtPath({
      treeData: sample(),
      path: ['a'],
      getNodeKey: keyById,
    })
    expect(() => structuredClone(found?.node)).not.toThrow()
  })

  it('returns null for a missing path', () => {
    expect(
      getNodeAtPath({ treeData: sample(), path: ['zz'], getNodeKey: keyById })
    ).toBeNull()
  })

  it('leaves the tree unchanged', () => {
    const treeData = sample()
    const before = structuredClone(treeData)
    getNodeAtPath({ treeData, path: ['a', 'a1'], getNodeKey: keyById })
    expect(treeData).toEqual(before)
  })
})

describe('addNodeUnderParent', () => {
  const newNode: TreeItem = { id: 'new', title: 'new' }

  it('appends at the root when parentKey is null or undefined', () => {
    for (const parentKey of [null, undefined]) {
      const result = addNodeUnderParent({
        treeData: sample(),
        newNode,
        parentKey,
        getNodeKey: keyById,
      })
      expect(result.treeData.map((n) => n['id'])).toEqual([
        'a',
        'b',
        'c',
        'new',
      ])
      expect(result.treeIndex).toBe(3)
    }
  })

  it('prepends at the root with addAsFirstChild', () => {
    const result = addNodeUnderParent({
      treeData: sample(),
      newNode,
      parentKey: null,
      getNodeKey: keyById,
      addAsFirstChild: true,
    })
    expect(result.treeData.map((n) => n['id'])).toEqual(['new', 'a', 'b', 'c'])
    expect(result.treeIndex).toBe(0)
  })

  it('appends under an existing parent', () => {
    const result = addNodeUnderParent({
      treeData: sample(),
      newNode,
      parentKey: 'a',
      getNodeKey: keyById,
    })
    expect(childrenOf(result.treeData[0]).map((n) => n['id'])).toEqual([
      'a1',
      'a2',
      'new',
    ])
  })

  it('prepends under an existing parent with addAsFirstChild', () => {
    const result = addNodeUnderParent({
      treeData: sample(),
      newNode,
      parentKey: 'a',
      getNodeKey: keyById,
      addAsFirstChild: true,
    })
    expect(childrenOf(result.treeData[0]).map((n) => n['id'])).toEqual([
      'new',
      'a1',
      'a2',
    ])
    expect(result.treeIndex).toBe(1)
  })

  it('creates a children array on a childless parent', () => {
    const result = addNodeUnderParent({
      treeData: sample(),
      newNode,
      parentKey: 'c',
      getNodeKey: keyById,
    })
    expect(childrenOf(result.treeData[2]).map((n) => n['id'])).toEqual(['new'])
    expect(result.treeIndex).toBe(6)
  })

  it('expands the parent when expandParent is set', () => {
    const result = addNodeUnderParent({
      treeData: sample(),
      newNode,
      parentKey: 'b',
      getNodeKey: keyById,
      expandParent: true,
    })
    expect(at(result.treeData, 1).expanded).toBe(true)
  })

  it('does not mutate the input tree', () => {
    const treeData = sample()
    const before = structuredClone(treeData)
    addNodeUnderParent({
      treeData,
      newNode,
      parentKey: 'a',
      getNodeKey: keyById,
    })
    expect(treeData).toEqual(before)
  })

  it('throws for an unknown parent key', () => {
    expect(() =>
      addNodeUnderParent({
        treeData: sample(),
        newNode,
        parentKey: 'nope',
        getNodeKey: keyById,
      })
    ).toThrow('No node found with the given key.')
  })

  it('refuses to add under function children', () => {
    const treeData: TreeItem[] = [
      {
        id: 'lazy',
        expanded: true,
        children: (() => {}) as GetTreeItemChildrenFn,
      },
    ]
    expect(() =>
      addNodeUnderParent({
        treeData,
        newNode,
        parentKey: 'lazy',
        getNodeKey: keyById,
      })
    ).toThrow(TypeError)
  })
})

describe('insertNode', () => {
  const newNode: TreeItem = { id: 'new', title: 'new' }

  it('inserts at the top level', () => {
    const result = insertNode({
      treeData: sample(),
      newNode,
      depth: 0,
      minimumTreeIndex: 0,
      getNodeKey: keyById,
    })
    expect(result.treeData.map((n) => n['id'])).toEqual(['new', 'a', 'b', 'c'])
    expect(result.treeIndex).toBe(0)
    expect(result.parentNode).toBeNull()
    expect(result.path).toEqual(['new'])
  })

  it('inserts as a child at depth 1 and reports the parent', () => {
    const result = insertNode({
      treeData: sample(),
      newNode,
      depth: 1,
      minimumTreeIndex: 1,
      getNodeKey: keyById,
    })
    expect(childrenOf(result.treeData[0]).map((n) => n['id'])).toContain('new')
    expect(result.parentNode?.['id']).toBe('a')
    expect(result.path).toEqual(['a', 'new'])
  })

  it('expands the receiving parent when expandParent is set', () => {
    const result = insertNode({
      treeData: sample(),
      newNode,
      depth: 1,
      minimumTreeIndex: 5,
      expandParent: true,
      getNodeKey: keyById,
    })
    expect(result.parentNode?.expanded).toBe(true)
  })

  it('appends at the end for an out-of-range minimumTreeIndex', () => {
    const result = insertNode({
      treeData: sample(),
      newNode,
      depth: 0,
      minimumTreeIndex: 99,
      getNodeKey: keyById,
    })
    expect(result.treeData.at(-1)?.['id']).toBe('new')
  })

  it('seeds an empty tree', () => {
    const result = insertNode({
      treeData: undefined as unknown as TreeItem[],
      newNode,
      depth: 0,
      minimumTreeIndex: 0,
      getNodeKey: keyById,
    })
    expect(result.treeData).toEqual([newNode])
    expect(result.treeIndex).toBe(0)
  })

  it('does not mutate the input tree', () => {
    const treeData = sample()
    const before = structuredClone(treeData)
    insertNode({
      treeData,
      newNode,
      depth: 1,
      minimumTreeIndex: 2,
      getNodeKey: keyById,
    })
    expect(treeData).toEqual(before)
  })

  // Regression: `traverseChildrenForInsert` used to spread `isPseudoRoot: true`
  // into every recursive call, so nested inserts reported `path: ['new']` and
  // `parentNode: null` no matter where the node actually landed. That payload is
  // handed straight to the consumer's `onMoveNode` as nextPath/nextParentNode.
  it('reports a path that actually resolves to the inserted node', () => {
    for (const [depth, minimumTreeIndex] of [
      [0, 0],
      [1, 1],
      [1, 2],
      [2, 2],
      [1, 99],
    ] as const) {
      const result = insertNode({
        treeData: sample(),
        newNode,
        depth,
        minimumTreeIndex,
        expandParent: true,
        getNodeKey: keyById,
      })
      const found = getNodeAtPath({
        treeData: result.treeData,
        path: result.path,
        getNodeKey: keyById,
      })
      expect(found?.node['id'], `depth=${depth} min=${minimumTreeIndex}`).toBe(
        'new'
      )
      expect(found?.treeIndex, `depth=${depth} min=${minimumTreeIndex}`).toBe(
        result.treeIndex
      )
    }
  })

  // `dragHover` relies on this: it needs the inserted node's path on every
  // mousemove, and taking it from insertNode's own return value avoids
  // re-flattening the whole tree just to read one row.
  it('returns the same path getFlatDataFromTree would report for that row', () => {
    for (const [depth, minimumTreeIndex] of [
      [0, 0],
      [0, 3],
      [1, 1],
      [1, 2],
      [1, 4],
      [2, 2],
      [2, 3],
      [1, 99],
    ] as const) {
      for (const getNodeKey of [keyById, defaultGetNodeKey]) {
        const result = insertNode({
          treeData: sample(),
          newNode,
          depth,
          minimumTreeIndex,
          expandParent: true,
          getNodeKey,
        })
        const rows = getFlatDataFromTree({
          treeData: result.treeData,
          getNodeKey,
        })
        expect(
          at(rows, result.treeIndex).path,
          `depth=${depth} min=${minimumTreeIndex}`
        ).toEqual(result.path)
      }
    }
  })

  it('reports the real parent node for a nested insert', () => {
    const result = insertNode({
      treeData: sample(),
      newNode,
      depth: 2,
      minimumTreeIndex: 2,
      getNodeKey: keyById,
    })
    expect(result.path.slice(0, -1)).toEqual(['a', 'a1'])
    expect(result.parentNode?.['id']).toBe('a1')
  })
})

describe('getFlatDataFromTree', () => {
  it('flattens visible rows in display order', () => {
    const rows = getFlatDataFromTree({
      treeData: sample(),
      getNodeKey: keyById,
    })
    expect(rows.map((r) => r.node['id'])).toEqual([
      'a',
      'a1',
      'a1a',
      'a2',
      'b',
      'c',
    ])
    expect(rows.map((r) => r.treeIndex)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('includes hidden rows when ignoreCollapsed is false', () => {
    const rows = getFlatDataFromTree({
      treeData: sample(),
      getNodeKey: keyById,
      ignoreCollapsed: false,
    })
    expect(rows.map((r) => r.node['id'])).toContain('b1')
  })

  it('carries path, parentNode and lowerSiblingCounts', () => {
    const rows = getFlatDataFromTree({
      treeData: sample(),
      getNodeKey: keyById,
    })
    const a1a = rows.find((r) => r.node['id'] === 'a1a')!
    expect(a1a.path).toEqual(['a', 'a1', 'a1a'])
    expect(a1a.parentNode?.['id']).toBe('a1')
    expect(a1a.lowerSiblingCounts).toEqual([2, 1, 0])
  })

  it('returns [] for an empty tree', () => {
    expect(getFlatDataFromTree({ treeData: [], getNodeKey: keyById })).toEqual(
      []
    )
  })
})

describe('getTreeFromFlatData', () => {
  it('nests rows by parent id', () => {
    const flatData = [
      { id: '1', parentId: '0', name: 'root' },
      { id: '2', parentId: '1', name: 'child' },
      { id: '3', parentId: '2', name: 'grandchild' },
      { id: '4', parentId: '0', name: 'root2' },
    ]
    const tree = getTreeFromFlatData({ flatData }) as unknown as TreeItem[]
    expect(tree).toHaveLength(2)
    expect(at(tree, 0)['name']).toBe('root')
    const child = childAt(tree[0], 0)
    expect(child['name']).toBe('child')
    expect(childAt(child, 0)['name']).toBe('grandchild')
  })

  it('honours custom key accessors and rootKey', () => {
    const flatData = [
      { key: 'r', parent: 'ROOT' },
      { key: 'k', parent: 'r' },
    ]
    const tree = getTreeFromFlatData({
      flatData,
      getKey: (n) => n.key,
      getParentKey: (n) => n.parent,
      rootKey: 'ROOT',
    }) as unknown as TreeItem[]
    expect(tree).toHaveLength(1)
    expect(childAt(tree[0], 0)['key']).toBe('k')
  })

  it('returns [] when nothing matches the root key', () => {
    expect(
      getTreeFromFlatData({ flatData: [{ id: '1', parentId: '9' }] })
    ).toEqual([])
    expect(getTreeFromFlatData({ flatData: [] })).toEqual([])
  })
})

describe('isDescendant', () => {
  it('detects direct and transitive descendants', () => {
    const [a] = sample()
    const a1 = childAt(a, 0)
    const a1a = childAt(a1, 0)
    expect(isDescendant(a, a1)).toBe(true)
    expect(isDescendant(a, a1a)).toBe(true)
    expect(isDescendant(a1, a)).toBe(false)
    expect(isDescendant(a, a)).toBe(false)
  })

  it('is false for childless and function-children nodes', () => {
    expect(isDescendant({ title: 'x' }, { title: 'y' })).toBe(false)
    const lazy: TreeItem = { children: (() => {}) as GetTreeItemChildrenFn }
    expect(isDescendant(lazy, { title: 'y' })).toBe(false)
  })
})

describe('getDepth', () => {
  it('measures the deepest branch', () => {
    const [a, b, c] = sample()
    expect(getDepth(a)).toBe(2)
    expect(getDepth(b)).toBe(1)
    expect(getDepth(c)).toBe(0)
  })

  it('counts function children as one level', () => {
    expect(getDepth({ children: (() => {}) as GetTreeItemChildrenFn })).toBe(1)
  })
})

const searchMethod = ({
  node,
  searchQuery,
}: {
  node: TreeItem
  searchQuery: string
}) => String(node['title'] ?? '').includes(searchQuery)

describe('find', () => {
  it('returns matches with their path and treeIndex', () => {
    const { matches } = find({
      treeData: sample(),
      getNodeKey: keyById,
      searchQuery: 'a1a',
      searchMethod,
    })
    expect(matches).toHaveLength(1)
    expect(at(matches, 0).node['id']).toBe('a1a')
    expect(at(matches, 0).path).toEqual(['a', 'a1', 'a1a'])
  })

  it('expands ancestors of every match when expandAllMatchPaths is set', () => {
    const { treeData } = find({
      treeData: sample(),
      getNodeKey: keyById,
      searchQuery: 'b1',
      searchMethod,
      expandAllMatchPaths: true,
    })
    expect(at(treeData, 1).expanded).toBe(true)
  })

  it('expands only the focused match when expandFocusMatchPaths is set', () => {
    const { treeData } = find({
      treeData: sample(),
      getNodeKey: keyById,
      searchQuery: '1',
      searchMethod,
      searchFocusOffset: 1,
      expandFocusMatchPaths: true,
    })
    // matches in order: a1, a1a, b1 — offset 1 is a1a, under the already-open a
    expect(at(treeData, 1).expanded).not.toBe(true)
  })

  it('finds every match across the forest', () => {
    const { matches } = find({
      treeData: sample(),
      getNodeKey: keyById,
      searchQuery: 'a',
      searchMethod,
    })
    expect(matches.map((m) => m.node['id'])).toEqual(['a', 'a1', 'a1a', 'a2'])
  })

  it('returns no matches for a query that hits nothing', () => {
    const { matches } = find({
      treeData: sample(),
      getNodeKey: keyById,
      searchQuery: 'zzz',
      searchMethod,
    })
    expect(matches).toEqual([])
  })

  it('does not mutate the input tree', () => {
    const treeData = sample()
    const before = structuredClone(treeData)
    find({
      treeData,
      getNodeKey: keyById,
      searchQuery: 'b1',
      searchMethod,
      expandAllMatchPaths: true,
    })
    expect(treeData).toEqual(before)
  })
})

describe('round-trips and invariants', () => {
  it('getFlatDataFromTree row count equals getVisibleNodeCount', () => {
    const treeData = sample()
    expect(getFlatDataFromTree({ treeData, getNodeKey: keyById })).toHaveLength(
      getVisibleNodeCount({ treeData })
    )
  })

  it('getDescendantCount agrees with a manual walk of each root', () => {
    for (const node of sample()) {
      let counted = -1 // walk visits the root itself first
      walk({
        treeData: [node],
        getNodeKey: keyById,
        callback: () => {
          counted += 1
        },
      })
      expect(getDescendantCount({ node })).toBe(counted)
    }
  })

  it('every flattened path resolves back to its own node', () => {
    const treeData = sample()
    const rows = getFlatDataFromTree({ treeData, getNodeKey: keyById })
    for (const row of rows) {
      const found = getNodeAtPath({
        treeData,
        path: row.path,
        getNodeKey: keyById,
      })
      expect(found?.node['id']).toBe(row.node['id'])
      expect(found?.treeIndex).toBe(row.treeIndex)
    }
  })

  it('remove-then-insert restores the original tree shape', () => {
    const treeData = sample()
    const removed = removeNode({
      treeData,
      path: ['a', 'a1'],
      getNodeKey: keyById,
    })!
    const restored = insertNode({
      treeData: removed.treeData,
      newNode: removed.node,
      depth: 1,
      minimumTreeIndex: removed.treeIndex,
      getNodeKey: keyById,
    })
    expect(restored.treeData).toEqual(treeData)
  })
})
