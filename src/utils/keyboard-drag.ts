import type { OnNavigate } from '@nosferatu500/react-dnd-keyboard-backend'
import type { DepthAnnouncement } from './announcements'

/**
 * Depth control for keyboard drags.
 *
 * Under a pointer, how deeply a node nests comes from horizontal travel:
 * `getBlocksOffset` divides that distance by the scaffold block width. A keyboard
 * drag has no pointer, so this supplies the same quantity from the left and right
 * arrow keys and the rest of the depth maths is untouched.
 *
 * The pointer path cannot simply be left to yield zero: the keyboard backend
 * *does* report a client offset — `centerOf(node)` at pick-up and on every hover
 * — and rows are full width, so the horizontal difference between a handle and a
 * hovered row is a couple of hundred pixels. Read as pointer travel that is
 * several levels of nesting, which used to drop every keyboard-dragged node as
 * deep as the tree allowed.
 *
 * Arrow keys arrive through the backend's `onNavigate` hook, which fires before
 * the hover moves and lets the application keep the key. Up and down are left
 * alone and still move between rows; left and right are taken for depth. The
 * hook replaced an earlier trick — a `Window` capture listener racing ahead of
 * the backend's `Document` one — that existed only because there was no
 * supported way in.
 */

/** What a controller needs from its tree, read at event time. */
export interface KeyboardDragOptions {
  /** Whether the keyboard backend, rather than a pointer, drives this drag. */
  isKeyboardDragging: () => boolean
  /** Right means deeper in ltr and shallower in rtl, as elsewhere in the tree. */
  isRtl: () => boolean
  /**
   * Speaks through the backend's live region. Required, because the backend
   * announces only what it did itself: a key the tree takes for depth would
   * otherwise pass in silence, which a screen-reader user cannot distinguish
   * from a key that did nothing.
   */
  announce: (message: string) => void
  /**
   * Builds the depth message.
   *
   * A function rather than a string table because the controller is created once
   * per tree and lives for its whole lifetime, while the `announcements` prop it
   * comes from can change on any render. Resolving it per keystroke is what lets
   * a consumer swap language without remounting the tree.
   */
  describeDepth: (params: DepthAnnouncement) => string
}

export interface KeyboardDragController {
  /** True while the keyboard backend is driving the current drag. */
  isDragging: () => boolean
  /** The keyboard analogue of the pointer's horizontal travel, in blocks. */
  blocksOffset: () => number
  /** Clears the accumulated depth. Called whenever a drag starts. */
  reset: () => void
  /**
   * Registered by whichever row is hovered, so an arrow key can re-run that
   * row's hover at the new depth. Cleared when the drag ends.
   */
  setReplayHover: (replay: (() => void) | undefined) => void
  /**
   * Re-derives the offset from the depth actually reached.
   *
   * `getTargetDepth` clamps to what the surrounding rows allow, so a request to
   * nest deeper than that is capped. Without this, those presses bank up and the
   * user has to unwind every one before the opposite arrow appears to do
   * anything.
   */
  syncToDepth: (achievedDepth: number, sourceInitialDepth: number) => void
  /** Starts receiving arrow keys. Returns the matching cleanup. */
  register: () => () => void
}

/** The half of a controller the module-level dispatcher talks to. */
interface NavigationHandler {
  /** Returns whether this tree took the key for depth. */
  handleNavigate: (direction: string) => boolean
}

const handlers = new Set<NavigationHandler>()

/**
 * Handed to `withKeyboard` once, at module scope, because a backend factory has
 * to be stable — while the controllers are per tree.
 *
 * Every mounted tree is offered the key. Each asks its own manager whether *it*
 * is the one being dragged, so at most one acts; a cross-tree drag reaches both
 * the source tree and the one being dropped into, which is what keeps their
 * depth offsets in step.
 */
export const treeOnNavigate: OnNavigate = (event) => {
  let claimed = false
  for (const handler of handlers) {
    if (handler.handleNavigate(event.direction)) claimed = true
  }
  // Keeps the key from moving the hover. The backend has already taken it from
  // the page either way — a drag in progress owns the arrow keys.
  if (claimed) event.preventDefault()
}

export const createKeyboardDragController = (
  options: KeyboardDragOptions
): KeyboardDragController => {
  let offset = 0
  let lastDepth: number | undefined
  let replayHover: (() => void) | undefined

  const handler: NavigationHandler = {
    handleNavigate: (direction) => {
      if (!options.isKeyboardDragging()) return false

      const rtl = options.isRtl()
      const deeper = rtl ? 'left' : 'right'
      const shallower = rtl ? 'right' : 'left'

      let delta: number
      if (direction === deeper) {
        delta = 1
      } else if (direction === shallower) {
        delta = -1
      } else {
        return false
      }

      const before = lastDepth
      offset += delta
      replayHover?.()

      // `replayHover` runs the hover synchronously, so `lastDepth` is now the
      // depth that was actually reached — which may be the same one, if the rows
      // around the insertion point would not allow another level.
      if (lastDepth === undefined) return true
      options.announce(
        options.describeDepth({
          depth: lastDepth + 1,
          changed: lastDepth !== before,
        })
      )
      return true
    },
  }

  return {
    isDragging: () => options.isKeyboardDragging(),
    blocksOffset: () => offset,
    reset: () => {
      offset = 0
      lastDepth = undefined
    },
    setReplayHover: (replay) => {
      replayHover = replay
    },
    syncToDepth: (achievedDepth, sourceInitialDepth) => {
      lastDepth = achievedDepth
      // The inverse of `getTargetDepth`'s `sourceInitialDepth + offset - 1`.
      offset = achievedDepth - sourceInitialDepth + 1
    },
    register: () => {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
  }
}
