import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The peer range is the one line of the manifest a consumer feels directly: get
 * it wrong and their install either fails or — worse — succeeds and throws at
 * render. A dependency bump can rewrite it without anyone deciding to, so these
 * pin it to what the changelog tells people to install.
 */
const read = (file: string) =>
  readFileSync(path.resolve(import.meta.dirname, '..', file), 'utf8')

const { peerDependencies } = JSON.parse(read('package.json')) as {
  peerDependencies: Record<string, string>
}

describe('React peer range', () => {
  it('is the range the newest changelog entry documents', () => {
    // Newest first, so the first match is the current claim.
    const documented = /React peer range is now `([^`]+)`/.exec(
      read('CHANGELOG.md')
    )?.[1]

    expect(peerDependencies.react).toBe(documented)
  })

  it('is the same for react and react-dom', () => {
    expect(peerDependencies['react-dom']).toBe(peerDependencies.react)
  })
})
