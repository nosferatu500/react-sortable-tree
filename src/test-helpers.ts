import { type TreeItem } from './types'

/**
 * Test-only accessors for indexed reads, which `noUncheckedIndexedAccess`
 * types as possibly `undefined`.
 *
 * Asserting the slot exists here — rather than `!` at every call site — keeps a
 * wrong assumption a named failure ("expected an item at index 2") instead of a
 * bare `Cannot read properties of undefined`. Not part of the published
 * bundle: nothing in `src/index.ts` reaches this module.
 */
export const at = <T>(items: readonly T[], index: number): T => {
  const item = items[index]
  if (item === undefined) {
    throw new Error(`expected an item at index ${index}, found none`)
  }
  return item
}

/** A node's children, asserting they were resolved into an array. */
export const childrenOf = (node: TreeItem | undefined): TreeItem[] => {
  const children = node?.children
  if (!Array.isArray(children)) {
    throw new TypeError('expected the node to have an array of children')
  }
  return children
}

/** `node.children[index]`. */
export const childAt = (node: TreeItem | undefined, index: number): TreeItem =>
  at(childrenOf(node), index)
