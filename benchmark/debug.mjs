/** Ad-hoc check that each harness really renders rows before trusting timings. */
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
    const path = join(dist, req.url)
    const body = await readFile(path)
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'text/plain' })
    res.end(body)
  } catch {
    res.writeHead(404).end('nope')
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const browser = await puppeteer.launch({
  executablePath:
    process.env.CHROME_PATH ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  defaultViewport: { width: 1200, height: 900 },
  args: ['--no-sandbox'],
})

for (const id of process.argv.slice(2)) {
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e}`))
  page.on('console', (m) => console.log(`  [console:${m.type()}] ${m.text()}`))
  await page.goto(`http://127.0.0.1:${port}/${id}.html`, { waitUntil: 'load' })
  await page.waitForFunction('window.__harnessReady === true')
  const info = await page.evaluate(async () => {
    const root = document.getElementById('root')
    const ms = await window.__harness.mount(100)
    const nodesAfterFlush = root.querySelectorAll('*').length
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
    const nodesAfterPaint = root.querySelectorAll('*').length
    const scroller = [...root.querySelectorAll('*')].find((el) => {
      const oy = getComputedStyle(el).overflowY
      return (
        (oy === 'auto' || oy === 'scroll') &&
        el.scrollHeight > el.clientHeight + 1
      )
    })
    return {
      ms,
      nodesAfterFlush,
      nodesAfterPaint,
      rows: root.querySelectorAll('[role="treeitem"], li').length,
      rects: root.getBoundingClientRect().toJSON(),
      scroller: scroller
        ? {
            tag: scroller.tagName,
            cls: scroller.className,
            scrollHeight: scroller.scrollHeight,
            clientHeight: scroller.clientHeight,
          }
        : null,
      html: root.innerHTML.slice(0, 700),
    }
  })
  console.log(`\n=== ${id} ===`)
  console.log(JSON.stringify(info, null, 2))
  await page.close()
}

await browser.close()
server.close()
