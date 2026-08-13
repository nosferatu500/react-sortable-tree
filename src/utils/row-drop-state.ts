import React, { createContext, useContext } from 'react'

/**
 * What the row's drop target knows, on its way to the row's content renderer.
 *
 * These three used to travel by `cloneElement`: `tree-node.tsx` ran
 * `Children.map(children, child => cloneElement(child, { isOver, canDrop,
 * draggedNode }))`, because the values are collected by the row's *drop target*
 * while the component that needs them is nested inside the row renderer, which
 * a consumer may replace wholesale.
 *
 * The provider deliberately sits in `wrapTarget` rather than in `TreeNode`.
 * Putting it in `TreeNode` would make it a custom `treeNodeRenderer`'s job to
 * provide it, and a renderer that did not would silently starve its content of
 * `isOver` — the same trap as forgetting to clone, moved somewhere less obvious.
 * From `wrapTarget` the context is outside anything a consumer can replace, so
 * every content renderer gets the values whatever the row renderer does.
 *
 * That is also why this is not a breaking change: a custom `treeNodeRenderer`
 * that still clones keeps working, because it injects the same values the
 * context carries.
 */
export interface RowDropState {
  isOver: boolean
  canDrop: boolean
  /**
   * Deliberately `unknown`, not `TreeItem<TData>`.
   *
   * A React context cannot be generic, and this value is never read here — it is
   * forwarded straight to a renderer typed as `ComponentType<any>`, which is where
   * a consumer's own `NodeRendererProps<TData>` gives it a real type again. Naming
   * a `TData` at this point would be inventing one.
   */
  draggedNode: unknown
}

/**
 * The defaults matter: a content renderer rendered outside any row — a custom
 * `treeNodeRenderer` that drops `children`, or a renderer used standalone in a
 * test — reads "not hovered, cannot drop" rather than crashing.
 */
const NOT_A_DROP_TARGET: RowDropState = {
  isOver: false,
  canDrop: false,
  draggedNode: undefined,
}

export const RowDropContext: React.Context<RowDropState> =
  createContext<RowDropState>(NOT_A_DROP_TARGET)

export const useRowDropState = (): RowDropState => useContext(RowDropContext)
