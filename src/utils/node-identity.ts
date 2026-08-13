import type { TreeItem, TreeItemFields } from '../types'

/**
 * Row identity for React reconciliation, independent of `getNodeKey`.
 *
 * `getNodeKey` produces *path segments*, and its default —
 * `({ treeIndex }) => treeIndex` — is positional: the same node has a different
 * key after anything above it is inserted, removed or reordered. Used as a React
 * key that makes React reuse a row's component instance for a *different* node,
 * so per-row state (an open editor, a checkbox, focus) sticks to the screen
 * position instead of the node.
 *
 * A node object's identity does not shift like that, so the tree keys rows by
 * that instead whenever the caller has not supplied its own `getNodeKey`. Ids
 * are assigned lazily on first render and held in a `WeakMap`, so a dropped
 * subtree is collected with its ids.
 *
 * Clone-on-write updates would break this on their own — `{ ...node, expanded }`
 * is a new object — so every helper in `tree-data-utils` that rebuilds a node in
 * place carries the old node's identity over with `cloneWithIdentity`.
 */
/**
 * Keyed on `object` rather than on `TreeItem`, deliberately. Identity is a
 * property of the object reference and has nothing to do with the node's shape,
 * so parameterising the map would only make every caller prove a `TData` that
 * the lookup never reads.
 */
const identities = new WeakMap<object, string>()
const sequence = { next: 0 }

/** The node's identity, assigning one if it does not have it yet. */
export const rowIdentity = <TData>(node: TreeItem<TData>): string => {
  const existing = identities.get(node)
  if (existing !== undefined) {
    return existing
  }
  sequence.next += 1
  const id = `rst-${sequence.next}`
  identities.set(node, id)
  return id
}

/**
 * `{ ...node, ...patch }`, keeping the node's row identity — the result is the
 * same logical row, so React should update it rather than rebuild it.
 */
export const cloneWithIdentity = <TData>(
  node: TreeItem<TData>,
  // Only the tree's own fields, not the consumer's: every caller is restructuring
  // the tree (`children`, `expanded`), and `Partial<TreeItem<TData>>` would be
  // unusable anyway — TypeScript cannot check an object literal against a
  // `Partial` of an unresolved type parameter.
  patch?: Partial<TreeItemFields<TData>>
): TreeItem<TData> => inheritIdentity(node, { ...node, ...patch })

/**
 * Give `next` whatever identity `previous` has. For call sites that build the
 * replacement themselves — including consumer `newNode` callbacks, whose result
 * is still the same logical row.
 *
 * `previous` is only ever used as a map key, so it is typed as loosely as that
 * job needs; `T` is preserved exactly so the caller gets its own node type back.
 */
export const inheritIdentity = <T extends object>(
  previous: object,
  next: T
): T => {
  if (next === previous) {
    return next
  }
  const id = identities.get(previous)
  if (id !== undefined) {
    identities.set(next, id)
  }
  return next
}
