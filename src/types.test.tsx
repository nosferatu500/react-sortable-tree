import React from 'react'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { SortableTree } from './react-sortable-tree'
import type { TreeItem } from './types'
import { defaultGetNodeKey } from './utils/default-handlers'
import {
  changeNodeAtPath,
  getFlatDataFromTree,
  getNodeAtPath,
  insertNode,
  removeNode,
} from './utils/tree-data-utils'

/*
 * Type-level tests for `TreeItem<TData>`.
 *
 * These matter more than the usual test: `npm test` cannot fail on a type that
 * has quietly widened to `any`, and the whole point of describing `TData` is the
 * checking. `expectTypeOf` is compile-time — its runtime call is a no-op — so
 * `npm run typecheck` is what actually runs this file, and `tsconfig.json`
 * includes `src`. The `@ts-expect-error` lines are the other half: each one fails
 * the build if the mistake below it *stops* being an error.
 *
 * An interface rather than a type alias on purpose. TypeScript gives object type
 * aliases an implicit index signature and interfaces none, so an interface is the
 * shape that used to be rejected outright by helpers typed on the old
 * index-signature `TreeItem` — the exact regression to guard.
 */
interface Doc {
  id: number
  owner: string
}

const docs = (): TreeItem<Doc>[] => [
  {
    id: 1,
    owner: 'ada',
    title: 'Roadmap',
    expanded: true,
    children: [{ id: 2, owner: 'ada', title: 'Q1' }],
  },
  { id: 3, owner: 'grace', title: 'Budget' },
]

describe('TreeItem<TData>', () => {
  it('accepts the tree fields alongside the described ones', () => {
    const tree = docs()
    expectTypeOf(tree[0]!.id).toEqualTypeOf<number>()
    expectTypeOf(tree[0]!.owner).toEqualTypeOf<string>()
    expectTypeOf(tree[0]!.expanded).toEqualTypeOf<boolean | undefined>()
    expect(tree).toHaveLength(2)
  })

  it('rejects fields the data does not declare, and wrong types', () => {
    // @ts-expect-error `ownr` is not a field of Doc
    const typo: TreeItem<Doc> = { id: 1, owner: 'ada', ownr: 'x' }
    // @ts-expect-error id is a number
    const wrong: TreeItem<Doc> = { id: 'one', owner: 'ada' }
    // @ts-expect-error owner is required by Doc
    const missing: TreeItem<Doc> = { id: 1 }
    expect([typo, wrong, missing]).toHaveLength(3)
  })

  it('keeps a bare TreeItem as permissive as it always was', () => {
    // The default `TData` is an index signature, so this still compiles — the
    // generic is opt-in and 4.6 is additive rather than breaking.
    const loose: TreeItem[] = [{ title: 'a', anything: 1, nested: { x: 2 } }]
    expectTypeOf(loose[0]!['anything']).toEqualTypeOf<unknown>()
    expect(loose).toHaveLength(1)
  })
})

describe('the helpers preserve TData', () => {
  it('through changeNodeAtPath', () => {
    const next = changeNodeAtPath({
      treeData: docs(),
      path: [0],
      newNode: { id: 9, owner: 'hopper', title: 'Renamed' },
      getNodeKey: defaultGetNodeKey,
    })
    expectTypeOf(next).toEqualTypeOf<TreeItem<Doc>[]>()
    expect(next[0]!.id).toBe(9)
  })

  it('through insertNode and removeNode', () => {
    const inserted = insertNode({
      treeData: docs(),
      newNode: { id: 4, owner: 'ada' },
      depth: 0,
      minimumTreeIndex: 0,
      getNodeKey: defaultGetNodeKey,
    })
    expectTypeOf(inserted.treeData).toEqualTypeOf<TreeItem<Doc>[]>()

    const removed = removeNode({
      treeData: docs(),
      path: [0],
      getNodeKey: defaultGetNodeKey,
    })
    expectTypeOf(removed?.treeData).toEqualTypeOf<TreeItem<Doc>[] | undefined>()
    expect(removed?.treeData).toHaveLength(1)
  })

  it('through getFlatDataFromTree and getNodeAtPath', () => {
    const flat = getFlatDataFromTree({
      treeData: docs(),
      getNodeKey: defaultGetNodeKey,
    })
    expectTypeOf(flat[0]!.node).toEqualTypeOf<TreeItem<Doc>>()
    expectTypeOf(flat[0]!.node.owner).toEqualTypeOf<string>()

    const found = getNodeAtPath({
      treeData: docs(),
      path: [0],
      getNodeKey: defaultGetNodeKey,
    })
    expectTypeOf(found?.node).toEqualTypeOf<TreeItem<Doc> | undefined>()
    expect(found?.node.id).toBe(1)
  })
})

describe('the component infers TData from treeData', () => {
  it('types every callback that receives a node', () => {
    // Not rendered — this test is about what the compiler accepts. Assigning the
    // element to a variable is enough to check the props.
    const element = (
      <SortableTree
        treeData={docs()}
        onChange={(next) => {
          expectTypeOf(next).toEqualTypeOf<TreeItem<Doc>[]>()
        }}
        onMoveNode={({ node, nextParentNode }) => {
          expectTypeOf(node.owner).toEqualTypeOf<string>()
          expectTypeOf(nextParentNode).toEqualTypeOf<TreeItem<Doc> | null>()
        }}
        canDrop={({ node, nextParent }) => {
          expectTypeOf(node.id).toEqualTypeOf<number>()
          return nextParent?.owner === node.owner
        }}
        canNodeHaveChildren={(node) => {
          expectTypeOf(node.id).toEqualTypeOf<number>()
          return true
        }}
        generateNodeProps={({ node }) => ({ 'data-owner': node.owner })}
        announcements={{
          moved: ({ node }) => `${node.owner} moved ${String(node.title)}`,
        }}
      />
    )
    expect(React.isValidElement(element)).toBe(true)
  })

  it('rejects a callback that assumes a field the data lacks', () => {
    // `TData` is pinned explicitly rather than inferred, so the mistake is
    // reported on the offending callback. Left to inference, TypeScript resolves
    // `TData` from the callback and blames `treeData` instead — caught either
    // way, but the message points at the wrong prop.
    const element = (
      <SortableTree<Doc>
        treeData={docs()}
        onChange={() => {}}
        canNodeHaveChildren={(node) =>
          // @ts-expect-error `assignee` is not a field of Doc
          node.assignee !== ''
        }
      />
    )
    expect(React.isValidElement(element)).toBe(true)
  })
})
