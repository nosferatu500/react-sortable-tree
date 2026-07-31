/**
 * What you have to install to use each library.
 *
 * Each entry lists the library plus the peers its own docs tell you to install,
 * minus react and react-dom, which any React app already has. --legacy-peer-deps
 * keeps npm from adding those two back. The distinction matters: this fork and
 * the original depend on react-dnd directly, while @minoru declares it a peer,
 * so counting only declared dependencies would silently drop it.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const work = join(here, '.footprint')

const TARGETS = [
  {
    id: 'fork',
    // react-dnd and its backend are both dependencies and peers here, so the
    // tarball alone pulls them in.
    specs: ['./vendor/nosferatu500-react-sortable-tree-6.0.0.tgz'],
  },
  { id: 'original', specs: ['react-sortable-tree@2.8.0'] },
  {
    id: 'minoru',
    // react-dnd is a peer with no matching dependency; the library cannot be
    // used without it.
    specs: ['@minoru/react-dnd-treeview@3.5.4', 'react-dnd@16'],
  },
]

/** Package directories, counting scoped packages individually. */
function countPackages(dir) {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    if (entry.name === '.bin') continue
    if (entry.name.startsWith('@'))
      total += countPackages(join(dir, entry.name))
    else total += 1
  }
  return total
}

function diskKB(dir) {
  const out = execFileSync('du', ['-sk', dir], { encoding: 'utf8' })
  return Number.parseInt(out.trim().split(/\s+/)[0], 10)
}

rmSync(work, { recursive: true, force: true })
const footprint = {}

for (const { id, specs } of TARGETS) {
  const dir = join(work, id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: `footprint-${id}`, private: true }) + '\n'
  )
  const resolved = specs.map((spec) =>
    spec.startsWith('.') ? join(here, spec) : spec
  )
  execFileSync(
    'npm',
    [
      'install',
      ...resolved,
      '--legacy-peer-deps',
      '--no-audit',
      '--no-fund',
      '--ignore-scripts',
      '--silent',
    ],
    { cwd: dir, stdio: 'ignore' }
  )
  const modules = join(dir, 'node_modules')
  footprint[id] = {
    packages: countPackages(modules),
    diskKB: diskKB(modules),
  }
  console.log(
    `  ${id.padEnd(9)} ${String(footprint[id].packages).padStart(3)} packages` +
      ` ${(footprint[id].diskKB / 1024).toFixed(1).padStart(6)} MB on disk`
  )
}

writeFileSync(
  join(here, 'footprint.json'),
  `${JSON.stringify(footprint, null, 2)}\n`
)
rmSync(work, { recursive: true, force: true })
console.log(`Wrote ${join(here, 'footprint.json')}`)
