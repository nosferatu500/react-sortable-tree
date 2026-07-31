import { useEffect, useLayoutEffect } from 'react'

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server, so SSR does not
 * warn about layout effects it cannot run.
 */
export const useIsomorphicLayoutEffect: typeof useEffect =
  globalThis.window == undefined ? useEffect : useLayoutEffect
