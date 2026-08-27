/**
 * Answers one question: is the extra ~1 ms on "Expand a group" the cost of
 * composing the keyboard backend over the pointer one?
 *
 * Method, from MODERNIZATION.md's appendix — the same trap applies here as to the
 * tree-data microbenchmarks:
 *
 * - both variants in one process, on one page, so JIT state is shared;
 * - the side order rotates every trial, so a GC pause cannot land on one side
 *   only and be mistaken for a result;
 * - the **minimum** is reported, not the median. Minimum is the right statistic
 *   for "how much work is there": noise only ever adds.
 *
 * Run with: node benchmark/attribution/keyboard-cost.mjs
 * Needs `npm run bench:setup` first, so the fork under test is the current build.
 */
import * as esbuild from 'esbuild'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, 'dist')
const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const NODES = Number(process.env.NODES ?? 1000)
const TRIALS = Number(process.env.TRIALS ?? 11)
// Expands per trial. One commit is below the clock's resolution; see the harness.
const CYCLES = Number(process.env.CYCLES ?? 20)
const WARMUP = 3

console.log(`Building the attribution page…`)
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
await esbuild.build({
  entryPoints: [join(here, 'keyboard-cost.jsx')],
  outfile: join(dist, 'keyboard-cost.js'),
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome120'],
  jsx: 'transform',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
})
writeFileSync(
  join(dist, 'index.html'),
  `<!doctype html>
<meta charset="utf-8">
<title>keyboard backend cost</title>
<link rel="stylesheet" href="keyboard-cost.css">
<style>html,body{margin:0;font-family:system-ui,sans-serif}#root{contain:content}</style>
<div id="root"></div>
<script src="keyboard-cost.js"></script>
`
)

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
}
const server = createServer(async (req, res) => {
  const name = req.url === '/' ? '/index.html' : req.url
  try {
    const body = await readFile(join(dist, name))
    res.writeHead(200, { 'content-type': MIME[extname(name)] ?? 'text/plain' })
    res.end(body)
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(0, resolve))
const url = `http://localhost:${server.address().port}/`

const browser = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-features=CalculateNativeWinOcclusion'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1000, height: 800 })
page.on('pageerror', (error) => console.error('  page error:', error.message))
await page.goto(url, { waitUntil: 'load' })
await page.waitForFunction('window.__harnessReady === true')

/** One mount → expand → unmount cycle, returning the commit time in ms. */
const trial = (variant) =>
  page.evaluate(
    async (v, total, cycles) => {
      await window.__harness.mount(v, total)
      const rows = window.__harness.rows()
      const collapsedHeight = window.__harness.scrollHeight()
      const { flush, expandedHeight } =
        await window.__harness.expandRepeatedly(cycles)
      await window.__harness.reset()
      return { flush, rows, collapsedHeight, expandedHeight }
    },
    variant,
    NODES,
    CYCLES
  )

console.log(
  `Measuring "expand a group" at ${NODES} nodes: ${TRIALS} interleaved trials of ` +
    `${CYCLES} expands each, after ${WARMUP} warm-up rounds…`
)

for (let i = 0; i < WARMUP; i += 1) {
  await trial('keyboard')
  await trial('pointer')
}

const samples = { keyboard: [], pointer: [] }
let shape = null
for (let i = 0; i < TRIALS; i += 1) {
  // Rotate the order every trial so neither side is always first.
  const order = i % 2 === 0 ? ['keyboard', 'pointer'] : ['pointer', 'keyboard']
  for (const variant of order) {
    const { flush, rows, collapsedHeight, expandedHeight } =
      await trial(variant)
    samples[variant].push(flush)
    shape ??= { rows, collapsedHeight, expandedHeight }
  }
}

await browser.close()
server.close()

const min = (xs) => Math.min(...xs)
const median = (xs) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)]

const k = samples.keyboard
const p = samples.pointer
const delta = min(k) - min(p)

// Proof the page is measuring an expand rather than a no-op. The DOM row count
// cannot show it — virtua renders a fixed window — so the virtualized height is
// what confirms the flattened list actually grew.
if (shape.expandedHeight <= shape.collapsedHeight) {
  console.error(
    `\n  ABORT: expanding did not grow the list ` +
      `(${shape.collapsedHeight}px → ${shape.expandedHeight}px). ` +
      `Nothing was measured.\n`
  )
  process.exit(1)
}
console.log(
  `\n  ${shape.rows} rows in the DOM either way; virtualized height ` +
    `${shape.collapsedHeight}px collapsed → ${shape.expandedHeight}px expanded\n`
)
const line = (label, xs) =>
  `  ${label.padEnd(22)} min ${min(xs).toFixed(2).padStart(6)} ms` +
  `  median ${median(xs).toFixed(2).padStart(6)} ms` +
  `  max ${Math.max(...xs)
    .toFixed(2)
    .padStart(6)} ms`
console.log(line('withTreeKeyboard(HTML5)', k))
console.log(line('HTML5Backend alone', p))
console.log(
  `\n  difference (min): ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} ms` +
    `  (${((min(k) / min(p) - 1) * 100).toFixed(0)}% of the pointer-only cost)`
)
console.log(
  '\n  Re-run to confirm: a difference that moves by more than itself between\n' +
    '  runs is noise, not a result.\n'
)
