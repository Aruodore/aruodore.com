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
  '/pieces/brownian-bridge',
  '/pieces/metropolis-hastings',
  '/pieces/gibbs-sampling',
  '/sketches',
  '/sketches/ornstein-uhlenbeck',
  '/notes',
  '/notes/on-the-square-root-of-time',
]
const failures = []

function metaContent(html, attribute, value) {
  const tag = html.match(new RegExp(`<meta[^>]+${attribute}=["']${value}["'][^>]*>`, 'i'))?.[0]
  return tag?.match(/content=["']([^"']+)["']/i)?.[1]
}

async function inspectSocialCard(route, html) {
  const image = metaContent(html, 'property', 'og:image')
  if (!image) {
    failures.push(`${route}: missing og:image`)
    return
  }
  if (!/\.png$/i.test(new URL(image).pathname)) {
    failures.push(`${route}: social image must be PNG`)
    return
  }
  if (metaContent(html, 'name', 'twitter:image') !== image) failures.push(`${route}: twitter:image must match og:image`)
  if (metaContent(html, 'property', 'og:image:width') !== '1200') failures.push(`${route}: og:image:width must be 1200`)
  if (metaContent(html, 'property', 'og:image:height') !== '630') failures.push(`${route}: og:image:height must be 630`)

  const assetPath = join(output, new URL(image).pathname)
  try {
    const data = await readFile(assetPath)
    if (data.subarray(1, 4).toString('ascii') !== 'PNG') {
      failures.push(`${route}: social image is not a valid PNG`)
      return
    }
    const width = data.readUInt32BE(16)
    const height = data.readUInt32BE(20)
    if (width !== 1200 || height !== 630)
      failures.push(`${route}: social image is ${width}x${height}, expected 1200x630`)
    if (data.readUInt8(24) !== 8) failures.push(`${route}: social image must use 8-bit color depth`)
  } catch {
    failures.push(`${route}: social image missing from generated output`)
  }
}

for (const route of routes) {
  const path = join(output, route, 'index.html')
  try {
    const html = await readFile(path, 'utf8')
    for (const required of ['<title>', 'name="description"', 'rel="canonical"']) {
      if (!html.includes(required)) failures.push(`${route}: missing ${required}`)
    }
    if (/^\/pieces\/[^/]+$/.test(route)) await inspectSocialCard(route, html)
    if (
      /<(?:brownian-motion|ornstein-uhlenbeck|first-passage|beta-binomial-update|brownian-bridge|metropolis-hastings|gibbs-sampling)(?:\s|>)/.test(
        html,
      )
    )
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
