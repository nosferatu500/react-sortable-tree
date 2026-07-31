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
  {
    head: 'Mount CPU',
    metric: 'mountCpuMs',
    get: (r) => `${ms(r.mountCpuMs)} ms`,
  },
  {
    head: 'Expand a group',
    metric: 'expandCpuMs',
    get: (r) => `${ms(r.expandCpuMs)} ms`,
  },
  {
    head: 'Scroll top→bottom CPU',
    metric: 'scrollCpuMs',
    get: (r) => `${ms(r.scrollCpuMs)} ms`,
  },
  { head: 'DOM elements', exact: 'domNodes', get: (r) => int(r.domNodes) },
  { head: 'Event listeners', exact: 'listeners', get: (r) => int(r.listeners) },
  {
    head: 'JS heap',
    metric: 'heapMB',
    get: (r) => `${r.heapMB.toFixed(1)} MB`,
  },
]

/**
 * Bold a timing only when the winner's *worst* run still beats the runner-up's
 * *best* run. Several cross-library gaps here are a few tenths of a
 * millisecond and the ranges sit on top of each other, so comparing medians
 * alone would advertise noise as a win.
 */
const decisiveWinner = (rowsForSize, metric) => {
  const entries = rowsForSize
    .map((r) => ({ lib: r.lib, s: r.spread?.[metric] }))
    .filter((e) => e.s)
  if (entries.length < 2) return null
  const [first, second] = [...entries].sort((a, b) => a.s.median - b.s.median)
  return first.s.max < second.s.min ? first.lib : null
}

/** Counts that do not vary between runs can just be compared directly. */
const exactWinner = (rowsForSize, key) => {
  const min = Math.min(...rowsForSize.map((r) => r[key]))
  const winners = rowsForSize.filter((r) => r[key] === min)
  return winners.length === 1 ? winners[0].lib : null
}

lines.push(row(['Nodes', 'Library', ...COLUMNS.map((c) => c.head)]))
lines.push(rule(2 + COLUMNS.length))
for (const size of report.meta.sizes) {
  const rowsForSize = ORDER.map((id) =>
    report.results.find((r) => r.lib === id && r.size === size)
  )
  const winners = COLUMNS.map((c) =>
    c.exact
      ? exactWinner(rowsForSize, c.exact)
      : decisiveWinner(rowsForSize, c.metric)
  )
  for (const result of rowsForSize) {
    lines.push(
      row([
        int(size),
        TITLES[result.lib]
          .replace('@minoru/react-dnd-treeview', '@minoru')
          .split(' v')[0],
        ...COLUMNS.map((c, i) => {
          const text = c.get(result)
          return winners[i] === result.lib ? best(text) : text
        }),
      ])
    )
  }
}

lines.push('')
const p95s = report.results.map((r) => r.frameP95Ms).filter((v) => v != null)
const dropped = report.results.reduce((n, r) => n + (r.framesOver50ms ?? 0), 0)
lines.push(
  `Scroll smoothness: p95 frame time ranged ${Math.min(...p95s).toFixed(1)}–${Math.max(...p95s).toFixed(1)} ms` +
    ` across every library and size, and ${dropped === 0 ? 'no run dropped a single frame' : `${dropped} frames exceeded 50 ms`}.` +
    ' Scroll CPU above is therefore headroom consumed, not jank observed.'
)

lines.push('')
lines.push('### First paint')
lines.push('')
lines.push(row(['Nodes', ...ORDER.map((id) => TITLES[id].split(' v')[0])]))
lines.push(rule(4))
for (const size of report.meta.sizes) {
  const rowsForSize = ORDER.map((id) =>
    report.results.find((x) => x.lib === id && x.size === size)
  )
  const winner = decisiveWinner(rowsForSize, 'mountPaintedMs')
  lines.push(
    row([
      int(size),
      ...rowsForSize.map((r) => {
        const text = `${ms(r.mountPaintedMs)} ms`
        return winner === r.lib ? best(text) : text
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
