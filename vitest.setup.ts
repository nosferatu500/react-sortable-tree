import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

// `globals: false`, so React Testing Library's automatic cleanup hook never
// registers itself. Unmount between tests explicitly or trees leak across them.
afterEach(cleanup)

// --- jsdom gaps that `virtua` depends on -----------------------------------
//
// jsdom implements no layout, and the virtualizer needs three things from it to
// decide how many rows to mount. Without all three it mounts none, and every
// component test asserts against an empty tree:
//
//   1. `ResizeObserver`, which jsdom does not implement at all.
//   2. A non-zero `contentRect` on the observer entries — that is the only size
//      virtua reads.
//   3. A non-null `offsetParent`. Virtua skips entries for detached elements
//      via `if (target.offsetParent)`, and jsdom returns null for everything.

const VIEWPORT_HEIGHT = 600
const VIEWPORT_WIDTH = 800
const ROW_HEIGHT = 62

/**
 * Virtua observes the scroll container (for the viewport size) and each item
 * wrapper (for row sizes). The wrappers are anonymous divs, so identify the
 * scroller instead — it is the element carrying `id="vlist"`, or any ancestor
 * of it — and treat everything else as a row.
 */
const isViewport = (el: Element) =>
  el.id === 'vlist' || el.querySelector('#vlist') !== null

const boxOf = (el: Element) => ({
  width: VIEWPORT_WIDTH,
  height: isViewport(el) ? VIEWPORT_HEIGHT : ROW_HEIGHT,
})

class TestResizeObserver implements ResizeObserver {
  #callback: ResizeObserverCallback
  #targets = new Set<Element>()

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback
  }

  observe(target: Element) {
    this.#targets.add(target)
    // Real observers fire once on observe with the element's current size.
    // Virtua relies on that first delivery to learn the viewport height.
    this.#deliver()
  }

  unobserve(target: Element) {
    this.#targets.delete(target)
  }

  disconnect() {
    this.#targets.clear()
  }

  #deliver() {
    const entries = [...this.#targets].map((target) => {
      const { width, height } = boxOf(target)
      const size = { inlineSize: width, blockSize: height }
      return {
        target,
        contentRect: {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: width,
          bottom: height,
          width,
          height,
          toJSON: () => ({}),
        } as DOMRectReadOnly,
        borderBoxSize: [size],
        contentBoxSize: [size],
        devicePixelContentBoxSize: [size],
      } satisfies ResizeObserverEntry
    })
    if (entries.length > 0) this.#callback(entries, this)
  }
}

beforeEach(() => {
  globalThis.ResizeObserver = TestResizeObserver

  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      return this.isConnected ? this.parentElement : null
    },
  })

  for (const [prop, pick] of [
    ['offsetHeight', 'height'],
    ['clientHeight', 'height'],
    ['offsetWidth', 'width'],
    ['clientWidth', 'width'],
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        return boxOf(this)[pick]
      },
    })
  }

  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const { width, height } = boxOf(this)
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect
  }
})
