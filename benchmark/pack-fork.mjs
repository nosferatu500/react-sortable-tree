/**
 * Packs the fork into `vendor/fork.tgz`.
 *
 * `npm pack` names the tarball after the current version, so referencing it
 * directly from package.json would break the benchmark install on every version
 * bump. Normalising to a fixed name keeps `file:./vendor/fork.tgz` valid
 * forever.
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const vendor = join(here, 'vendor')

mkdirSync(vendor, { recursive: true })
// Clear old tarballs so the one just packed is unambiguous.
for (const file of readdirSync(vendor)) {
  if (file.endsWith('.tgz')) rmSync(join(vendor, file))
}

execFileSync('npm', ['pack', '--pack-destination', vendor], {
  cwd: root,
  stdio: 'inherit',
})

const packed = readdirSync(vendor).find((f) => f.endsWith('.tgz'))
if (!packed) throw new Error('npm pack produced no tarball')
renameSync(join(vendor, packed), join(vendor, 'fork.tgz'))
console.log(`packed ${packed} -> vendor/fork.tgz`)

/*
 * Evict the previously installed copy, from `node_modules` *and* the lockfile.
 *
 * The fixed tarball name above is what keeps `file:./vendor/fork.tgz` valid
 * across version bumps — but it also means the specifier never changes, so npm
 * reports "up to date" and restores the version recorded in `package-lock.json`
 * by its integrity hash. The benchmark then measures whatever version was
 * installed first, and says nothing about it: this was caught with a 7.0.0
 * tarball on disk and 6.0.0 in `node_modules`.
 *
 * Only this one entry is dropped, so every other pin in the lockfile survives.
 */
const installed = join(
  here,
  'node_modules',
  '@nosferatu500',
  'react-sortable-tree'
)
rmSync(installed, { recursive: true, force: true })

const lockPath = join(here, 'package-lock.json')
if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  const key = 'node_modules/@nosferatu500/react-sortable-tree'
  if (lock.packages?.[key]) {
    delete lock.packages[key]
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
  }
}
console.log('evicted the previously installed copy so npm re-extracts it')
