import type { TreeItem } from '../types'

/**
 * The strings the *tree* speaks, as opposed to the ones its keyboard backend
 * speaks.
 *
 * The split is not arbitrary. The backend narrates the drag it can see — picked
 * up, over row 3 of 8, dropped, cancelled — and those strings are per-backend,
 * so they are replaced through `withTreeKeyboard`'s `announcements` option. What
 * the backend cannot know is what the rows *mean*: that the node is now a child
 * of "Documents" at depth 2, or that a request to nest deeper was refused by the
 * rows around it. Those are per-tree, which is why they arrive as a prop.
 *
 * Override any subset; anything left out keeps the English default.
 */
export interface TreeAnnouncements {
  /** A move is committed but its `onDrop` has not resolved yet. */
  moving?: (params: MoveAnnouncement) => string
  /** A move is done — after `onDrop` resolves, when there is one. */
  moved?: (params: MoveAnnouncement) => string
  /** An `onDrop` rejected and the tree reverted the move. */
  moveFailed?: (params: MoveAnnouncement) => string
  /**
   * The depth changed, or was asked to change and could not.
   *
   * A key the tree takes for itself has to be narrated by the tree: the backend
   * announces only what it did, so a depth change claimed through `onNavigate`
   * would otherwise pass in silence — indistinguishable, to a screen-reader
   * user, from a key that did nothing at all.
   */
  depth?: (params: DepthAnnouncement) => string
}

/** What a move message is built from. */
export interface MoveAnnouncement {
  /** The node that moved. */
  node: TreeItem
  /** Its new parent, when it has one. */
  parentNode: TreeItem | undefined
  /** How deep it landed, counting from 1 like the default messages do. */
  depth: number
}

/** What a depth message is built from. */
export interface DepthAnnouncement {
  /** The depth now in effect, counting from 1. */
  depth: number
  /**
   * False when the arrow key was understood but the surrounding rows would not
   * allow another level, so the depth is the same as before.
   */
  changed: boolean
}

/**
 * A node's name for speech. Only a plain-string title can be used: a `ReactNode`
 * or a render function may be anything at all, and rendering one to text here is
 * neither possible nor cheap.
 */
const nameOf = (node: TreeItem): string =>
  typeof node.title === 'string' ? node.title : 'Item'

/** " under Documents", or nothing when the node landed at the top level. */
const under = (parentNode: TreeItem | undefined): string =>
  parentNode && typeof parentNode.title === 'string'
    ? ` under ${parentNode.title}`
    : ''

/**
 * The English defaults, exported so a consumer can wrap one rather than rewrite
 * it — the common case being a translation that still wants the same shape.
 */
export const defaultTreeAnnouncements: Required<TreeAnnouncements> = {
  moving: ({ node, parentNode, depth }) =>
    `${nameOf(node)} moving to depth ${depth}${under(parentNode)}.`,
  moved: ({ node, parentNode, depth }) =>
    `${nameOf(node)} moved to depth ${depth}${under(parentNode)}.`,
  moveFailed: ({ node, parentNode, depth }) =>
    `${nameOf(node)} could not be moved to depth ${depth}${under(parentNode)}. Returned to its previous position.`,
  depth: ({ depth, changed }) =>
    changed ? `Depth ${depth}.` : `Depth ${depth}, unchanged.`,
}
