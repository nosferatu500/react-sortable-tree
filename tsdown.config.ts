import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'tsdown'

const VIRTUAL_PREFIX = '\0rst-inject-css:'
// The virtual id must not *end* in ".css", or @tsdown/css claims it and tries
// to parse the JS we return as a stylesheet.
const VIRTUAL_SUFFIX = '?inject'

/**
 * Reproduces the runtime style injection that rollup-plugin-postcss did: each
 * `.css` import becomes a JS module that appends a <style> tag when imported.
 * This preserves the published contract that consumers never import a
 * stylesheet themselves.
 *
 * CSS imports are rewritten to a virtual, non-".css" id so that neither
 * tsdown's css-guard nor @tsdown/css (lightningcss) claims them and tries to
 * emit a separate stylesheet.
 */
function injectCssPlugin() {
  return {
    name: 'rst:inject-css',
    resolveId: {
      filter: { id: /\.css$/ },
      handler(source: string, importer: string | undefined) {
        const resolved = importer
          ? path.resolve(path.dirname(importer), source)
          : path.resolve(source)
        return VIRTUAL_PREFIX + resolved + VIRTUAL_SUFFIX
      },
    },
    load: {
      // Matches the prefix without embedding the NUL byte in the pattern
      // itself, which would be a control character in a regex.
      filter: { id: /rst-inject-css:/ },
      async handler(id: string) {
        const file = id.slice(
          VIRTUAL_PREFIX.length,
          id.length - VIRTUAL_SUFFIX.length
        )
        const css = await readFile(file, 'utf8')
        return {
          code: [
            `if (typeof document !== 'undefined') {`,
            `  const style = document.createElement('style')`,
            `  style.appendChild(document.createTextNode(${JSON.stringify(css)}))`,
            `  document.head.appendChild(style)`,
            `}`,
            '',
          ].join('\n'),
          moduleType: 'js' as const,
        }
      },
    },
  }
}

// React Compiler is opt-in via REACT_COMPILER=true, and must stay that way for
// now: its output imports `react/compiler-runtime`, which React 19 exports but
// React 18 does not. package.json still lists react ^18.0.0 as a supported
// peer, so shipping a compiled build by default would break React 18 consumers
// with an unresolvable import.
//
// To make it the default, first do one of:
//   - drop ^18.0.0 from the react/react-dom peer ranges (a major version bump), or
//   - add the `react-compiler-runtime` polyfill as a dependency for React 18.
const useReactCompiler = process.env['REACT_COMPILER'] === 'true'

/**
 * Runs babel-plugin-react-compiler over the TypeScript sources.
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
 * by counting `memo_cache_sentinel` occurrences in lib/index.js after a
 * `REACT_COMPILER=true` build before upgrading.
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

const reactCompilerPlugins = () => {
  if (!useReactCompiler) return []
  console.log('🚀 Building with React Compiler enabled')
  return [reactCompilerPlugin()]
}

export default defineConfig({
  entry: 'src/index.ts',
  outDir: 'lib',
  format: 'esm',
  sourcemap: true,
  clean: true,
  dts: true,
  // Emit lib/index.js + lib/index.d.ts rather than .mjs/.d.mts. Plain .js is
  // already unambiguous ESM because package.json sets "type": "module", and it
  // keeps the paths in the "exports" map stable.
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  plugins: [injectCssPlugin(), ...reactCompilerPlugins()],
})
