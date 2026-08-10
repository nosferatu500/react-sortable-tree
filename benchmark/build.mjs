/**
 * Bundles the three harness pages and measures what each library costs to ship.
 *
 * Everything is built the way an application would build it: production React,
 * minified, tree-shaken.
 */
import * as esbuild from 'esbuild'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, 'dist')
const sizeWork = join(here, '.sizework')

const REACT_EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react-dom/client',
]
/**
 * Every drag-and-drop layer any of the three libraries can pull in.
 *
 * Used only for the "library alone" size variant, which answers "how big is the
 * library once its drag-and-drop stack is treated as already present". Each
 * library imports just its own, so listing all of them keeps that comparison
 * like-for-like: the fork is on `@nosferatu500/react-dnd` 19 plus the keyboard
 * backend, while `@minoru/react-dnd-treeview` and the original are on upstream
 * `react-dnd` 16. Omitting the scoped names would charge the fork for a layer the
 * others are credited as free.
 */
const DND_EXTERNALS = [
  'react-dnd',
  'react-dnd-html5-backend',
  '@nosferatu500/react-dnd',
  '@nosferatu500/react-dnd-html5-backend',
  '@nosferatu500/react-dnd-keyboard-backend',
]

const shared = {
  bundle: true,
  minify: true,
  target: ['chrome120'],
  jsx: 'transform',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
}

const HARNESSES = [
  { name: 'fork', entry: join(here, 'harness/fork.jsx') },
  { name: 'minoru', entry: join(here, 'harness/minoru.jsx') },
  { name: 'original', entry: join(here, 'legacy/original.jsx') },
  // Not a benchmark page: it only records whether the original library can be
  // mounted on React 19 at all.
  { name: 'compat19', entry: join(here, 'compat19/original-react19.jsx') },
]

const page = (name, hasCss) => `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>benchmark: ${name}</title>
${hasCss ? `<link rel="stylesheet" href="${name}.css">` : ''}
<style>html,body{margin:0;font-family:system-ui,sans-serif}#root{contain:content}</style>
<div id="root"></div>
<script src="${name}.js"></script>
`

async function buildHarnesses() {
  rmSync(dist, { recursive: true, force: true })
  mkdirSync(dist, { recursive: true })

  for (const { name, entry } of HARNESSES) {
    // The compatibility page is built in development mode so React's error
    // messages arrive in full instead of as a minified error code.
    const isCompat = name === 'compat19'
    await esbuild.build({
      ...shared,
      entryPoints: [entry],
      outfile: join(dist, `${name}.js`),
      format: 'iife',
      minify: !isCompat,
      define: {
        'process.env.NODE_ENV': isCompat ? '"development"' : '"production"',
      },
    })
    const hasCss = existsSync(join(dist, `${name}.css`))
    writeFileSync(join(dist, `${name}.html`), page(name, hasCss))
    console.log(`  built ${name}.html${hasCss ? ' (+ css)' : ''}`)
  }
}

const measure = (bytes) => ({
  raw: bytes.length,
  gzip: gzipSync(bytes, { level: 9 }).length,
  brotli: brotliCompressSync(bytes).length,
})

/**
 * Bundle size of the library's public entry point, twice: once with the shared
 * react-dnd layer treated as already present, once with it included.
 */
async function measureLibrary({ name, pkg, resolveDir, css }) {
  const variant = async (external) => {
    const result = await esbuild.build({
      ...shared,
      stdin: {
        contents: `export * from ${JSON.stringify(pkg)}\n`,
        resolveDir,
        loader: 'js',
      },
      external,
      format: 'esm',
      outfile: join(sizeWork, `${name}.js`),
      write: false,
    })
    const js = result.outputFiles.find((f) => f.path.endsWith('.js'))
    const cssOut = result.outputFiles.find((f) => f.path.endsWith('.css'))
    return {
      js: measure(js.contents),
      injectedCss: cssOut ? measure(cssOut.contents) : null,
    }
  }

  const libraryOnly = await variant([...REACT_EXTERNALS, ...DND_EXTERNALS])
  const withDnd = await variant(REACT_EXTERNALS)

  return {
    package: pkg,
    libraryOnly: libraryOnly.js,
    withDndStack: withDnd.js,
    injectedCss: libraryOnly.injectedCss,
    stylesheet: css && existsSync(css) ? measure(readFileSync(css)) : null,
  }
}

console.log('Building harness pages…')
await buildHarnesses()

console.log('Measuring bundle size…')
const sizes = {}
sizes.fork = await measureLibrary({
  name: 'fork',
  pkg: '@nosferatu500/react-sortable-tree',
  resolveDir: here,
  css: join(
    here,
    'node_modules/@nosferatu500/react-sortable-tree/lib/style.css'
  ),
})
sizes.minoru = await measureLibrary({
  name: 'minoru',
  pkg: '@minoru/react-dnd-treeview',
  resolveDir: here,
  css: null,
})
sizes.original = await measureLibrary({
  name: 'original',
  pkg: 'react-sortable-tree',
  resolveDir: join(here, 'legacy'),
  css: join(here, 'legacy/node_modules/react-sortable-tree/style.css'),
})

rmSync(sizeWork, { recursive: true, force: true })
writeFileSync(join(here, 'sizes.json'), `${JSON.stringify(sizes, null, 2)}\n`)

const kb = (n) => `${(n / 1024).toFixed(1)} kB`
for (const [name, s] of Object.entries(sizes)) {
  console.log(
    `  ${name.padEnd(9)} lib ${kb(s.libraryOnly.gzip).padStart(9)} gz` +
      ` | +dnd ${kb(s.withDndStack.gzip).padStart(9)} gz` +
      ` | css ${s.stylesheet ? kb(s.stylesheet.gzip) : s.injectedCss ? `${kb(s.injectedCss.gzip)} (injected)` : 'none'}`
  )
}
