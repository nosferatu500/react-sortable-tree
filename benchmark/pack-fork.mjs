/**
 * Packs the fork into `vendor/fork.tgz`.
 *
 * `npm pack` names the tarball after the current version, so referencing it
 * directly from package.json would break the benchmark install on every version
 * bump. Normalising to a fixed name keeps `file:./vendor/fork.tgz` valid
 * forever.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
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
