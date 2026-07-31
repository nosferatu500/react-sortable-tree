import { defineConfig } from 'tsdown'

/**
 * CSS is emitted as a real stylesheet (`lib/styles.css`) by @tsdown/css, which
 * is installed purely to claim the `.css` imports in src/ — no configuration of
 * its own is needed.
 *
 * v5 instead rewrote each `.css` import into a JS module that appended a <style>
 * tag at import time. That was dropped in v6: it forced ~14 kB of stylesheet
 * into every consumer's JS bundle even when they only imported a tree utility,
 * required `style-src 'unsafe-inline'` under a strict CSP, emitted nothing
 * during SSR (so server HTML flashed unstyled at hydration), and gave consumers
 * no deterministic way to win the cascade. Consumers now import
 * `@nosferatu500/react-sortable-tree/styles.css` themselves.
 */

/**
 * Runs babel-plugin-react-compiler over the TypeScript sources.
 *
 * As of v6 this always runs — there is no un-compiled build path. The compiled
 * output imports `react/compiler-runtime`, which React 19 exports; the React 18
 * peer range was dropped in v6, so no polyfill is needed.
 *
 * This calls @babel/core directly instead of going through
 * @rollup/plugin-babel: that plugin peers on `rollup` (no longer a dependency
 * since the move to tsdown) and on `@babel/core@^7`, and it is CJS, so it
 * cannot load the ESM-only @babel/core 8.
 *
 * Babel parses TypeScript and JSX itself here and prints them back out
 * unchanged; rolldown/oxc still does the actual TS stripping and JSX lowering
 * afterwards. Running before JSX is lowered is what React Compiler wants — it
 * produces better output from real JSX than from already-lowered _jsx() calls.
 *
 * Stay on @babel/core 7 for now. Under 8.0.1, babel-plugin-react-compiler@1.0.0
 * silently stops memoizing NodeRendererDefault (4 memo caches drop to 3, and
 * the bundle shrinks ~10 kB) — it still depends on @babel/types@^7. The build
 * succeeds, so this regression is invisible unless the output is checked. Retest
 * by counting `memo_cache_sentinel` occurrences in lib/index.js after a build
 * before upgrading.
 */
const reactCompilerPlugin = () => ({
  name: 'rst:react-compiler',
  transform: {
    filter: { id: /\.tsx?$/ },
    async handler(code: string, id: string) {
      const { transformAsync } = await import('@babel/core')
      // `jsx` must only be enabled for .tsx. In a plain .ts file `<T>(...)` is
      // a generic parameter, and the JSX parser reads the `<` as a tag.
      const parserPlugins: ('typescript' | 'jsx')[] = id.endsWith('.tsx')
        ? ['typescript', 'jsx']
        : ['typescript']

      const result = await transformAsync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        browserslistConfigFile: false,
        sourceMaps: true,
        parserOpts: { plugins: parserPlugins },
        plugins: [['babel-plugin-react-compiler', {}]],
      })

      if (!result?.code) return null
      return { code: result.code, map: result.map }
    },
  },
})

export default defineConfig({
  entry: 'src/index.ts',
  outDir: 'lib',
  format: 'esm',
  target: 'es2025',
  sourcemap: true,
  clean: true,
  dts: true,
  // Emit lib/index.js + lib/index.d.ts rather than .mjs/.d.mts. Plain .js is
  // already unambiguous ESM because package.json sets "type": "module", and it
  // keeps the paths in the "exports" map stable.
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  plugins: [reactCompilerPlugin()],
})
