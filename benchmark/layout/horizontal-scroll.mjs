/**
 * Checks that a row wider than the viewport can be scrolled to.
 *
 * This cannot be a unit test: jsdom has no layout, so `scrollWidth` is always 0
 * there and the bug this guards against — a deeply nested row clipped with no
 * horizontal scrollbar, its action buttons unreachable — is invisible to it.
 * `npm test` pins the CSS property the fix turns on; this pins the behaviour.
 *
 * Three wrong theories died here, which is why this exists rather than a comment:
 *
 * 1. "`overflow-x` is not set." It is — `overflow-x: visible` beside
 *    `overflow-y: auto` computes to `auto`, so the scroller was already willing.
 * 2. "The scroller's `contain: strict` clips it." It does clip, but dropping the
 *    paint containment changed nothing, because there was still no overflow to
 *    scroll.
 * 3. "Give the row `width: max-content`." No effect, and it made the row
 *    *narrower*: `.rst__nodeContent` is absolutely positioned, so `max-content`
 *    measures only the scaffold blocks.
 *
 * The cause was virtua's row wrapper carrying `contain: layout`, which stops the
 * row's overflow counting towards the scroller's scrollable area. See
 * `PresentationalItem` in `src/react-sortable-tree.tsx`.
 *
 * Run with: node benchmark/layout/horizontal-scroll.mjs
 * Needs `npm run build` first — it loads `lib/`, not `src/`.
 */
import * as esbuild from 'esbuild'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const here = dirname(fileURLToPath(import.meta.url))
const REPO = join(here, '../..')
const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

await esbuild.build({
  entryPoints: [join(here, 'deep-tree.jsx')],
  outfile: join(here, 'dist/app.js'),
  bundle: true,
  format: 'iife',
  target: ['chrome120'],
  jsx: 'transform',
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: {
    '@rst/style.css': join(REPO, 'lib/style.css'),
    '@rst': join(REPO, 'lib/index.js'),
    // The entry lives under benchmark/, so a bare `react` would resolve to that
    // workspace's copy while lib/ uses the repo's — two Reacts, and a null
    // dispatcher the moment the compiled output calls `useMemoCache`.
    react: join(REPO, 'node_modules/react'),
    'react-dom': join(REPO, 'node_modules/react-dom'),
  },
  absWorkingDir: REPO,
  logLevel: 'error',
})

const html = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="app.css">
<style>html,body{margin:0;font-family:system-ui}</style>
<div id="root"></div><script src="app.js"></script>`

const MIME = { '.js': 'text/javascript', '.css': 'text/css' }
const server = createServer(async (req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html' }).end(html)
    return
  }
  try {
    const body = await readFile(join(here, 'dist', req.url))
    res
      .writeHead(200, {
        'content-type': MIME[extname(req.url)] ?? 'text/plain',
      })
      .end(body)
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(0, resolve))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 900, height: 520 })
page.on('pageerror', (error) => console.error('  page error:', error.message))
await page.goto(`http://localhost:${server.address().port}/`, {
  waitUntil: 'load',
})
await page.waitForSelector('.rst__rowTitle')

const result = await page.evaluate(async () => {
  const scroller = document.querySelector('#vlist')

  // Force a landing pad on one row. Its `::before` is `z-index: -1`, so it is
  // what disappears if the fix drops the per-row stacking context — the failure
  // mode of the obvious version of this fix, and worth failing loudly on.
  const rows = [...document.querySelectorAll('.rst__row')]
  rows[2]?.classList.add('rst__rowLandingPad')
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 250)))

  const deepest = [...document.querySelectorAll('.rst__node')].at(-1)
  const button = deepest?.querySelector('.probe-button')
  const padColor = getComputedStyle(rows[2], '::before').backgroundColor

  scroller.scrollLeft = 1e5
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 150)))

  const box = document.getElementById('box').getBoundingClientRect()
  const btn = button?.getBoundingClientRect()
  return {
    clientWidth: scroller.clientWidth,
    scrollWidth: scroller.scrollWidth,
    scrolledTo: Math.round(scroller.scrollLeft),
    buttonReachable: btn
      ? btn.right <= box.right + 1 && btn.left >= box.left - 1
      : false,
    landingPadPaints: padColor !== 'rgba(0, 0, 0, 0)' && padColor !== '',
  }
})

await browser.close()
server.close()

const failures = []
if (result.scrollWidth <= result.clientWidth) {
  failures.push(
    `the scroller reports no horizontal overflow (scrollWidth ` +
      `${result.scrollWidth} <= clientWidth ${result.clientWidth})`
  )
}
if (result.scrolledTo === 0) {
  failures.push('scrolling right moved nothing')
}
if (!result.buttonReachable) {
  failures.push("the deepest row's button is unreachable after scrolling right")
}
if (!result.landingPadPaints) {
  failures.push(
    'the landing pad no longer paints — the row stacking context was lost'
  )
}

console.log(
  `  scrollWidth ${result.scrollWidth} / clientWidth ${result.clientWidth}` +
    `  scrolledTo ${result.scrolledTo}` +
    `  buttonReachable ${result.buttonReachable}` +
    `  landingPadPaints ${result.landingPadPaints}`
)
if (failures.length > 0) {
  console.error(
    `\n  FAILED:\n${failures.map((f) => `    - ${f}`).join('\n')}\n`
  )
  process.exit(1)
}
console.log('\n  OK: a row wider than the viewport can be scrolled to.\n')
