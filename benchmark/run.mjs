/**
 * Drives the three harness pages in a real Chrome and records what each one costs.
 *
 * The headline numbers are main-thread CPU time, taken from Chrome's own
 * Performance.getMetrics ThreadTime counter around each scenario. Wall-clock
 * alone would be dominated by vsync waiting, and vsync cannot be disabled
 * without decoupling requestAnimationFrame from actual painting, which silently
 * breaks every "wait for the frame" measurement. See README.md for the two
 * counters that looked right and were not.
 *
 * Each scenario runs RUNS times after a discarded warm-up; medians are reported
 * because a single slow first paint would otherwise dominate a mean.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { readFileSync, writeFileSync } from 'node:fs'
import { extname, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cpus, totalmem } from 'node:os'
import puppeteer from 'puppeteer-core'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, 'dist')

const SIZES = [100, 1000, 10_000]
// 5 was too few: mount and expand differ between the two react-sortable-tree
// builds by a few tenths of a millisecond, and which one "won" flipped between
// otherwise identical benchmark runs. 11 stabilises the medians enough that the
// separation test in report.mjs gives the same answer twice in a row.
const RUNS = 11
const SCROLL_STEPS = 40
const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const LIBRARIES = [
  {
    id: 'fork',
    label: '@nosferatu500/react-sortable-tree (this fork)',
    pkg: join(here, 'node_modules/@nosferatu500/react-sortable-tree'),
    reactPkg: join(here, 'node_modules/react'),
  },
  {
    id: 'original',
    label: 'react-sortable-tree (original)',
    pkg: join(here, 'legacy/node_modules/react-sortable-tree'),
    reactPkg: join(here, 'legacy/node_modules/react'),
  },
  {
    id: 'minoru',
    label: '@minoru/react-dnd-treeview',
    pkg: join(here, 'node_modules/@minoru/react-dnd-treeview'),
    reactPkg: join(here, 'node_modules/react'),
  },
]

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
}

function serve() {
  const server = createServer(async (req, res) => {
    try {
      const body = await readFile(join(dist, req.url))
      res.writeHead(200, {
        'content-type': MIME[extname(req.url)] ?? 'text/plain',
      })
      res.end(body)
    } catch {
      res.writeHead(404).end('not found')
    }
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, port: server.address().port })
    )
  })
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))]
}

const version = (pkgDir) =>
  JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).version

/**
 * Cumulative renderer counters.
 *
 * ThreadTime is the renderer main thread's CPU time and ProcessTime covers the
 * whole renderer process. ScriptDuration is deliberately not used: work started
 * from a CDP evaluate is booked to DevToolsCommandDuration instead, so it reads
 * as near-zero here and would flatter whichever library does most of its work
 * inside the driver's call.
 */
async function counters(client) {
  const { metrics } = await client.send('Performance.getMetrics')
  const get = (name) => metrics.find((m) => m.name === name)?.value ?? 0
  return {
    cpuMs: get('ThreadTime') * 1000,
    processCpuMs: get('ProcessTime') * 1000,
    taskMs: get('TaskDuration') * 1000,
    nodes: get('Nodes'),
    listeners: get('JSEventListeners'),
    layoutObjects: get('LayoutObjects'),
  }
}

/** Runs one scenario and attributes the work it caused to it. */
async function scenario(client, body) {
  const before = await counters(client)
  const value = await body()
  const after = await counters(client)
  const delta = Object.fromEntries(
    Object.keys(after).map((key) => [key, after[key] - before[key]])
  )
  return { value, ...delta }
}

async function heapBytes(client) {
  await client.send('HeapProfiler.collectGarbage')
  const { metrics } = await client.send('Performance.getMetrics')
  return metrics.find((m) => m.name === 'JSHeapUsedSize').value
}

async function runLibrary(browser, port, library) {
  const rows = []
  for (const size of SIZES) {
    const page = await browser.newPage()
    const client = await page.createCDPSession()
    await client.send('Performance.enable')
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))

    await page.goto(`http://127.0.0.1:${port}/${library.id}.html`, {
      waitUntil: 'load',
    })
    await page.waitForFunction('window.__harnessReady === true', {
      timeout: 60_000,
    })

    // What the empty page already costs, so the mounted readings below can be
    // reported as the tree's own footprint.
    await client.send('HeapProfiler.collectGarbage')
    const baseline = await counters(client)

    const samples = []
    for (let run = 0; run <= RUNS; run++) {
      const mount = await scenario(client, () =>
        page.evaluate((n) => window.__harness.mount(n), size)
      )
      // Absolute, not a delta: detached listeners from the previous iteration's
      // unmount are only accounted for once they are collected, which made
      // per-iteration deltas go negative at 10k nodes.
      const mounted = await counters(client)
      const domNodes = await page.evaluate(() => window.__harness.domNodes())
      const renderedRows = await page.evaluate(() => window.__harness.rows())
      const collapse = await scenario(client, () =>
        page.evaluate(() => window.__harness.collapseFirstGroup())
      )
      const expand = await scenario(client, () =>
        page.evaluate(() => window.__harness.expandFirstGroup())
      )
      const scroll = await scenario(client, () =>
        page.evaluate((steps) => window.__harness.scroll(steps), SCROLL_STEPS)
      )
      const heap = await heapBytes(client)
      await page.evaluate(() => window.__harness.reset())
      await client.send('HeapProfiler.collectGarbage')

      if (run === 0) continue // warm-up
      samples.push({
        mount,
        mounted,
        domNodes,
        renderedRows,
        collapse,
        expand,
        scroll,
        heap,
      })
    }

    if (errors.length) {
      console.warn(`  ! ${library.id}@${size} page errors:`, errors.slice(0, 3))
    }

    const frames = samples.flatMap((s) => s.scroll.value?.frames ?? [])

    /**
     * Median plus the observed range, for the metrics the README compares
     * libraries on. Without the spread there is no way to tell a real win from
     * run-to-run noise — several cross-library gaps here are well under a
     * millisecond, which is inside what these numbers wobble by.
     */
    const spread = (values) => ({
      median: median(values),
      min: Math.min(...values),
      max: Math.max(...values),
    })

    const row = {
      lib: library.id,
      size,
      spread: {
        mountCpuMs: spread(samples.map((s) => s.mount.cpuMs)),
        expandCpuMs: spread(samples.map((s) => s.expand.cpuMs)),
        scrollCpuMs: spread(samples.map((s) => s.scroll.cpuMs)),
        mountPaintedMs: spread(samples.map((s) => s.mount.value.painted)),
        heapMB: spread(samples.map((s) => s.heap / 1024 / 1024)),
      },
      mountCpuMs: median(samples.map((s) => s.mount.cpuMs)),
      mountProcessCpuMs: median(samples.map((s) => s.mount.processCpuMs)),
      mountFlushMs: median(samples.map((s) => s.mount.value.flush)),
      mountPaintedMs: median(samples.map((s) => s.mount.value.painted)),
      collapseCpuMs: median(samples.map((s) => s.collapse.cpuMs)),
      expandCpuMs: median(samples.map((s) => s.expand.cpuMs)),
      expandFlushMs: median(samples.map((s) => s.expand.value.flush)),
      domNodes: median(samples.map((s) => s.domNodes)),
      renderedRows: median(samples.map((s) => s.renderedRows)),
      listeners: median(
        samples.map((s) => s.mounted.listeners - baseline.listeners)
      ),
      layoutObjects: median(
        samples.map((s) => s.mounted.layoutObjects - baseline.layoutObjects)
      ),
      heapMB: median(samples.map((s) => s.heap)) / 1024 / 1024,
      scrollCpuMs: median(samples.map((s) => s.scroll.cpuMs)),
      scrollWallMs: median(
        samples.map((s) => s.scroll.value?.total ?? Number.NaN)
      ),
      frameMedianMs: frames.length ? median(frames) : null,
      frameP95Ms: frames.length ? percentile(frames, 95) : null,
      framesOver50ms: frames.length
        ? frames.filter((f) => f > 50).length / samples.length
        : null,
      errors: errors.length,
    }
    rows.push(row)

    console.log(
      `  ${library.id.padEnd(9)} ${String(size).padStart(6)} nodes` +
        ` | mount cpu ${row.mountCpuMs.toFixed(1).padStart(8)}ms` +
        ` painted ${row.mountPaintedMs.toFixed(1).padStart(7)}ms` +
        ` | rows ${String(row.renderedRows).padStart(6)}` +
        ` dom ${String(row.domNodes).padStart(6)}` +
        ` listeners ${String(row.listeners).padStart(6)}` +
        ` | expand cpu ${row.expandCpuMs.toFixed(1).padStart(7)}ms` +
        ` | scroll cpu ${row.scrollCpuMs.toFixed(0).padStart(6)}ms` +
        ` p95 frame ${row.frameP95Ms?.toFixed(1).padStart(6)}ms` +
        ` | heap ${row.heapMB.toFixed(1).padStart(6)}MB`
    )
    await page.close()
  }
  return rows
}

/** Screenshots so the three harnesses can be eyeballed for a like-for-like layout. */
async function screenshots(port, ids) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    defaultViewport: { width: 1000, height: 700 },
    args: ['--no-sandbox', '--force-device-scale-factor=1'],
  })
  for (const id of ids) {
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${port}/${id}.html`, {
      waitUntil: 'load',
    })
    await page.waitForFunction('window.__harnessReady === true')
    await page.evaluate(() => window.__harness.mount(100))
    await new Promise((resolve) => setTimeout(resolve, 400))
    await page.screenshot({ path: join(dist, `shot-${id}.png`) })
    await page.close()
  }
  await browser.close()
}

/** Whether the original library can be mounted on React 19 at all. */
async function react19Compat(port) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage()
  const consoleErrors = []
  page.on('pageerror', (error) => consoleErrors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.goto(`http://127.0.0.1:${port}/compat19.html`, {
    waitUntil: 'load',
  })
  let result
  try {
    await page.waitForFunction('window.__done === true', { timeout: 15_000 })
    result = await page.evaluate(() => window.__result)
  } catch {
    result = { mounted: false, error: 'harness never finished', rows: 0 }
  }
  await browser.close()
  return {
    ...result,
    consoleErrors: consoleErrors
      .filter((text) => !text.includes('Failed to load resource'))
      .slice(0, 4),
  }
}

const { server, port } = await serve()
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 1200, height: 900 },
  args: [
    '--no-sandbox',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--force-device-scale-factor=1',
  ],
})

console.log(`Chrome ${await browser.version()}`)
const results = []
for (const library of LIBRARIES) {
  console.log(`\n${library.label}  (react ${version(library.reactPkg)})`)
  results.push(...(await runLibrary(browser, port, library)))
}
await browser.close()

await screenshots(
  port,
  LIBRARIES.map((l) => l.id)
)

console.log('\nOriginal react-sortable-tree on React 19:')
const compat = await react19Compat(port)
console.log(`  mounted: ${compat.mounted}`)
for (const error of [compat.error, ...compat.consoleErrors].filter(Boolean)) {
  console.log(`  ${error.slice(0, 200)}`)
}

const report = {
  meta: {
    date: new Date().toISOString(),
    node: process.version,
    cpu: cpus()[0]?.model,
    cores: cpus().length,
    memoryGB: Math.round(totalmem() / 1024 ** 3),
    runs: RUNS,
    scrollSteps: SCROLL_STEPS,
    sizes: SIZES,
  },
  libraries: Object.fromEntries(
    LIBRARIES.map((l) => [
      l.id,
      { label: l.label, version: version(l.pkg), react: version(l.reactPkg) },
    ])
  ),
  bundles: JSON.parse(readFileSync(join(here, 'sizes.json'), 'utf8')),
  // footprint.json is written by footprint.mjs and read straight from there by
  // report.mjs; copying it in here would go stale the next time it is measured.
  originalOnReact19: compat,
  results,
}

writeFileSync(
  join(here, 'results.json'),
  `${JSON.stringify(report, null, 2)}\n`
)
console.log(`\nWrote ${join(here, 'results.json')}`)

server.close()
