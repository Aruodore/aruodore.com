import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { readPieceFrontmatter } from './lib/social-release.mjs'

const piecesDirectory = join(process.cwd(), 'content/pieces')
const publisher = join(process.cwd(), 'scripts/publish-piece.mjs')
const files = (await readdir(piecesDirectory)).filter((file) => file.endsWith('.md')).sort()
let failed = false

for (const file of files) {
  const piece = readPieceFrontmatter(await readFile(join(piecesDirectory, file), 'utf8'))
  if (!Object.keys(piece.social).length) continue

  console.log(`Checking ${piece.slug} (${basename(file)})`)
  const result = spawnSync(process.execPath, [publisher, '--publish', piece.slug], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.stdout.trim()) console.log(result.stdout.trim())
  if (result.status !== 0) {
    failed = true
    console.error(result.stderr.trim() || `${piece.slug}: publisher exited ${result.status}`)
  }
}

if (failed) process.exit(1)
