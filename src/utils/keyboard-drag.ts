/**
 * Depth control for keyboard drags.
 *
 * Under the mouse, how deeply a node nests comes from how far the pointer moved
 * horizontally — `getBlocksOffset` divides that distance by the scaffold block
 * width. A keyboard drag has no pointer, so this supplies the same quantity
 * from the left/right arrow keys and the rest of the depth maths is unchanged.
 *
 * Two details make it work:
 *
 * - **The keyboard backend does report a client offset**, so the pointer maths
 *   cannot simply be left to return zero. `beginDrag` and every `hover` pass
 *   `centerOf(node)`, and rows are full width — so the horizontal difference
 *   between the source handle and a hovered row is a couple of hundred pixels,
 *   which the pointer path would read as several blocks of nesting and drop
 *   every keyboard-dragged node as deep as the tree allows.
 * - **A `Window` capture listener runs before a `Document` one.** The backend
 *   attaches its `keydown` to the document in the capture phase and skips any
 *   event whose `defaultPrevented` is already set, so claiming left/right here
 *   takes them away from its target navigation without patching or racing it.
 *   Up/down are left alone and still move between rows.
 */

/** What the controller needs from the tree, read at event time. */
export interface KeyboardDragOptions {
  /** Whether the keyboard backend — rather than a pointer — drives this drag. */
  isKeyboardDragging: () => boolean
  /** Right means deeper in ltr and shallower in rtl, as elsewhere in the tree. */
  isRtl: () => boolean
}

export interface KeyboardDragController {
  /** True while the keyboard backend is driving the current drag. */
  isDragging: () => boolean
  /** The keyboard analogue of the pointer's horizontal travel, in blocks. */
  blocksOffset: () => number
  /** Clears the accumulated depth. Called when any drag starts. */
  reset: () => void
  /**
   * Registered by whichever row is hovered, so an arrow key can re-run that
   * row's hover at the new depth. Cleared when the drag ends.
   */
  setReplayHover: (replay: (() => void) | undefined) => void
  /**
   * Re-derives the offset from the depth actually reached.
   *
   * `getTargetDepth` clamps its result to what the surrounding rows allow, so a
   * request to go deeper than that is silently capped. Without this, those
   * presses would bank up and the user would have to unwind every one of them
   * before the opposite arrow appeared to do anything.
   */
  syncToDepth: (achievedDepth: number, sourceInitialDepth: number) => void
  /**
   * Starts listening. Returns the matching cleanup.
   *
   * Typed as the `EventTarget` slice actually used, so `globalThis` is accepted
   * — it is not assignable to `Window` under `lib.dom`.
   */
  attach: (
    target: Pick<Window, 'addEventListener' | 'removeEventListener'>
  ) => () => void
}

export const createKeyboardDragController = (
  options: KeyboardDragOptions
): KeyboardDragController => {
  let offset = 0
  let replayHover: (() => void) | undefined

  const handleKeyDown = (event: KeyboardEvent): void => {
    // Mirrors the backend's own guards: an already-claimed key, or a chord,
    // belongs to someone else.
    if (event.defaultPrevented) return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (!options.isKeyboardDragging()) return

    const rtl = options.isRtl()
    const deeper = rtl ? 'ArrowLeft' : 'ArrowRight'
    const shallower = rtl ? 'ArrowRight' : 'ArrowLeft'

    let delta: number
    if (event.key === deeper) {
      delta = 1
    } else if (event.key === shallower) {
      delta = -1
    } else {
      return
    }

    // Claim it before the backend's document-capture listener runs, so the key
    // changes depth instead of moving to another row.
    event.preventDefault()
    offset += delta
    replayHover?.()
  }

  return {
    isDragging: () => options.isKeyboardDragging(),
    blocksOffset: () => offset,
    reset: () => {
      offset = 0
    },
    setReplayHover: (replay) => {
      replayHover = replay
    },
    syncToDepth: (achievedDepth, sourceInitialDepth) => {
      // The inverse of `getTargetDepth`'s `sourceInitialDepth + offset - 1`.
      offset = achievedDepth - sourceInitialDepth + 1
    },
    attach: (target) => {
      // Capture, and on the window rather than the document, so this runs ahead
      // of the backend's own document-capture listener.
      const listenerOptions = { capture: true } as const
      target.addEventListener('keydown', handleKeyDown, listenerOptions)
      return () => {
        target.removeEventListener('keydown', handleKeyDown, listenerOptions)
      }
    },
  }
}
