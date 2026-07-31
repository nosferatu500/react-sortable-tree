import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // jsdom for everything: the tree-data-utils tests don't need a DOM but
    // don't care either, and a single environment keeps the config honest.
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Component styling is not under test; the real stylesheet is verified by
    // the build. Parsing it on every run just costs time.
    css: false,
  },
})
