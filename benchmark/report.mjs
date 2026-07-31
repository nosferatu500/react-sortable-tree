/** Renders results.json as the markdown tables used in the README. */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const report = JSON.parse(readFileSync(join(here, 'results.json'), 'utf8'))
report.footprint = JSON.parse(
  readFileSync(join(here, 'footprint.json'), 'utf8')
)

const ORDER = ['fork', 'original', 'minoru']
const TITLES = {
  fork: `this fork v${report.libraries.fork.version}`,
  original: `react-sortable-tree v${report.libraries.original.version}`,
  minoru: `@minoru/react-dnd-treeview v${report.libraries.minoru.version}`,
}
const REACT_SUPPORT = {
  fork: '19',
  original: '16 only',
  minoru: '18, 19',
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`
const int = (n) => Math.round(n).toLocaleString('en-US')
const ms = (n) => (n >= 100 ? int(n) : n.toFixed(1))
const best = (text) => `**${text}**`

const row = (cells) => `| ${cells.join(' | ')} |`
const rule = (n) => `|${' --- |'.repeat(n)}`

const lines = []
lines.push('### Shipping cost')
lines.push('')
lines.push(row(['', ...ORDER.map((id) => TITLES[id])]))
lines.push(rule(4))

const bundleRow = (label, pick, lower = true) => {
  const values = ORDER.map((id) => pick(report.bundles[id]))
  const numeric = values.filter((v) => typeof v === 'number')
  const winner = lower ? Math.min(...numeric) : Math.max(...numeric)
  return row([
    label,
    ...values.map((v) =>
      typeof v !== 'number' ? v : v === winner ? best(kb(v)) : kb(v)
    ),
  ])
}

lines.push(
  bundleRow('JS, minified + gzipped (library alone)', (b) => b.libraryOnly.gzip)
)
lines.push(
  bundleRow(
    'JS, minified + gzipped (with `react-dnd` + HTML5 backend)',
    (b) => b.withDndStack.gzip
  )
)
lines.push(
  bundleRow('Stylesheet, gzipped', (b) =>
    b.stylesheet ? b.stylesheet.gzip : 'none (headless)'
  )
)

const packages = ORDER.map((id) => report.footprint[id].packages)
lines.push(
  row([
    'npm packages installed',
    ...packages.map((p) =>
      p === Math.min(...packages) ? best(int(p)) : int(p)
    ),
  ])
)
const disk = ORDER.map((id) => report.footprint[id].diskKB)
lines.push(
  row([
    '`node_modules` on disk',
    ...disk.map((d) => {
      const text = `${(d / 1024).toFixed(1)} MB`
      return d === Math.min(...disk) ? best(text) : text
    }),
  ])
)
lines.push(
  row(['React versions supported', ...ORDER.map((id) => REACT_SUPPORT[id])])
)

lines.push('')
lines.push('### Runtime')
lines.push('')

const COLUMNS = [
  { head: 'Mount CPU', get: (r) => `${ms(r.mountCpuMs)} ms` },
  { head: 'Expand a group', get: (r) => `${ms(r.expandCpuMs)} ms` },
  { head: 'Scroll top→bottom CPU', get: (r) => `${ms(r.scrollCpuMs)} ms` },
  { head: 'DOM elements', get: (r) => int(r.domNodes) },
  { head: 'Event listeners', get: (r) => int(r.listeners) },
  { head: 'JS heap', get: (r) => `${r.heapMB.toFixed(1)} MB` },
]

lines.push(row(['Nodes', 'Library', ...COLUMNS.map((c) => c.head)]))
lines.push(rule(2 + COLUMNS.length))
for (const size of report.meta.sizes) {
  for (const id of ORDER) {
    const result = report.results.find((r) => r.lib === id && r.size === size)
    lines.push(
      row([
        int(size),
        TITLES[id]
          .replace('@minoru/react-dnd-treeview', '@minoru')
          .split(' v')[0],
        ...COLUMNS.map((c) => c.get(result)),
      ])
    )
  }
}

lines.push('')
lines.push('### First paint')
lines.push('')
lines.push(row(['Nodes', ...ORDER.map((id) => TITLES[id].split(' v')[0])]))
lines.push(rule(4))
for (const size of report.meta.sizes) {
  lines.push(
    row([
      int(size),
      ...ORDER.map((id) => {
        const r = report.results.find((x) => x.lib === id && x.size === size)
        return `${ms(r.mountPaintedMs)} ms`
      }),
    ])
  )
}

lines.push('')
lines.push('### Environment')
lines.push('')
lines.push(
  `${report.meta.cpu}, ${report.meta.cores} cores, ${report.meta.memoryGB} GB, macOS.`,
  `Node ${report.meta.node}. Median of ${report.meta.runs} runs after a discarded warm-up.`,
  `React ${report.libraries.fork.react} for this fork and @minoru,`,
  `React ${report.libraries.original.react} for the original.`
)
lines.push('')
lines.push(
  `Original on React 19: mounted = ${report.originalOnReact19.mounted}.`
)
lines.push('')
lines.push('```')
lines.push(report.originalOnReact19.error ?? '(no error)')
lines.push('```')

const out = `${lines.join('\n')}\n`
writeFileSync(join(here, 'RESULTS.md'), out)
process.stdout.write(out)
