/** Dumps every DevTools metric delta for one scenario, to pick honest counters. */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, 'dist')
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
}

const server = createServer(async (req, res) => {
  try {
    const body = await readFile(join(dist, req.url))
    res.writeHead(200, {
      'content-type': MIME[extname(req.url)] ?? 'text/plain',
    })
    res.end(body)
  } catch {
    res.writeHead(404).end('nope')
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const [id, size] = [process.argv[2], Number(process.argv[3])]
const browser = await puppeteer.launch({
  executablePath:
    process.env.CHROME_PATH ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  defaultViewport: { width: 1200, height: 900 },
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
const client = await page.createCDPSession()
await client.send('Performance.enable')
await page.goto(`http://127.0.0.1:${port}/${id}.html`, { waitUntil: 'load' })
await page.waitForFunction('window.__harnessReady === true')

const snap = async () => {
  const { metrics } = await client.send('Performance.getMetrics')
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]))
}

// warm-up, then measure
await page.evaluate((n) => window.__harness.mount(n), size)
await page.evaluate(() => window.__harness.reset())

const before = await snap()
const timing = await page.evaluate((n) => window.__harness.mount(n), size)
const after = await snap()

console.log(
  `${id} @ ${size}: flush ${timing.flush.toFixed(1)}ms painted ${timing.painted.toFixed(1)}ms`
)
for (const key of Object.keys(after)) {
  const delta = after[key] - before[key]
  if (Math.abs(delta) > 0.0001)
    console.log(`  ${key.padEnd(26)} ${delta.toFixed(4)}`)
}

await browser.close()
server.close()
