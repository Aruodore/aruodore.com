import { readFile, readdir } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'

const root = process.cwd()
const ignoredDirectories = new Set([
  '.git',
  '.nuxt',
  '.output',
  'coverage',
  'lighthouse-report',
  'node_modules',
  'playwright-report',
  'test-results',
  '.lighthouseci',
])
const exactExceptions = new Set([
  '.prettierrc.json',
  'CITATION.cff',
  'CLAUDE.md',
  'LICENSE',
  'package.json',
  'package-lock.json',
  'README.md',
  'tsconfig.json',
])
const frameworkPatterns = [/^\[[a-z0-9-]+\]\.vue$/]
const kebabFilename = /^(?:\.[a-z0-9-]+|[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*)$/
const failures = []
const sourceFiles = []

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await visit(path)
    else {
      sourceFiles.push(path)
      if (
        !exactExceptions.has(entry.name) &&
        !frameworkPatterns.some((pattern) => pattern.test(entry.name)) &&
        !kebabFilename.test(entry.name)
      )
        failures.push(relative(root, path))
    }
  }
}

await visit(root)
for (const path of sourceFiles) {
  if (!/\.(?:js|mjs|ts|vue|md)$/.test(path)) continue
  const content = await readFile(path, 'utf8')
  const relativePath = relative(root, path)
  if (relativePath.startsWith('tests/') && /\b(?:describe|it|test)\.(?:only|skip)\s*\(/.test(content))
    failures.push(`${relativePath} (focused or skipped test)`)
  if (/components\/(?:[^'"\n]+\/)*[A-Z][^'"\n]*\.vue/.test(content) || /^::[A-Z]/m.test(content))
    failures.push(`${relativePath} (legacy component naming)`)
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content))
    failures.push(`${relativePath} (private key material)`)
}
if (failures.length) {
  console.error(`Filename policy violations:\n${failures.map((path) => `- ${path}`).join('\n')}`)
  process.exitCode = 1
} else {
  console.log(`Filename audit passed from ${basename(root)}.`)
}
