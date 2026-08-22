import { access, readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const output = '.output/public'
const routes = [
  '/',
  '/about',
  '/pieces',
  '/pieces/brownian-motion',
  '/pieces/ornstein-uhlenbeck',
  '/pieces/first-passage',
  '/pieces/beta-binomial-update',
  '/sketches',
  '/sketches/ornstein-uhlenbeck',
  '/notes',
  '/notes/on-the-square-root-of-time',
]
const failures = []

for (const route of routes) {
  const path = join(output, route, 'index.html')
  try {
    const html = await readFile(path, 'utf8')
    for (const required of ['<title>', 'name="description"', 'rel="canonical"']) {
      if (!html.includes(required)) failures.push(`${route}: missing ${required}`)
    }
    if (/<(?:brownian-motion|ornstein-uhlenbeck|first-passage|beta-binomial-update)(?:\s|>)/.test(html))
      failures.push(`${route}: unresolved custom element`)
  } catch {
    failures.push(`${route}: generated page missing`)
  }
}

for (const path of ['sitemap.xml', 'feed.xml', 'robots.txt']) {
  try {
    await access(join(output, path))
  } catch {
    failures.push(`${path}: missing`)
  }
}

async function inspectAssets(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await inspectAssets(path)
    else {
      const size = (await stat(path)).size
      if (entry.name.endsWith('.js') && size > 600_000) failures.push(`${path}: JavaScript exceeds 600 kB`)
      if (/\.(png|jpg|jpeg|webp)$/i.test(entry.name) && size > 1_500_000) failures.push(`${path}: image exceeds 1.5 MB`)
      if (entry.name.endsWith('.map')) failures.push(`${path}: public source map present`)
    }
  }
}
await inspectAssets(output)

if (failures.length) {
  console.error(`Production audit failed:\n${failures.map((item) => `- ${item}`).join('\n')}`)
  process.exitCode = 1
} else console.log('Production artifact audit passed.')
