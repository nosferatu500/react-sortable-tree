import { type ViteUserConfig, defineConfig } from 'vitest/config'

/**
 * Runs `test/` against the built bundle in `lib/`, which the main suite never
 * touches — it imports `src`, so React Compiler output goes unexercised.
 *
 * A separate config rather than a wider `include`, so `npm test` and watch mode
 * stay build-free. Use `npm run test:build`, which builds first.
 */
const config: ViteUserConfig = defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    css: false,
  },
})

export default config
