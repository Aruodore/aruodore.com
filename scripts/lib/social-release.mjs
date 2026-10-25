import { readFile } from 'node:fs/promises'

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export function readPieceFrontmatter(markdown) {
  const block = markdown.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/)?.[1]
  if (!block) throw new Error('piece has no YAML frontmatter')

  const value = (key) => {
    const match = block.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'))
    if (!match) throw new Error(`piece is missing ${key}`)
    return match[1].replace(/^(['"])(.*)\1$/, '$2')
  }

  /** @type {Partial<Record<'x' | 'linkedin', string>>} */
  const social = {}
  const lines = block.split('\n')
  const start = lines.findIndex((line) => line === 'social_post:')
  if (start >= 0) {
    for (let index = start + 1; index < lines.length; index += 1) {
      const header = lines[index].match(/^ {2}(x|linkedin):\s*(?:\|-|-\||>)?\s*$/)
      if (!header) {
        if (lines[index] && !lines[index].startsWith('  ')) break
        continue
      }
      const body = []
      index += 1
      while (index < lines.length && (lines[index].startsWith('    ') || lines[index] === '')) {
        body.push(lines[index].startsWith('    ') ? lines[index].slice(4) : '')
        index += 1
      }
      index -= 1
      social[header[1]] = body.join('\n').trim()
    }
  }

  return {
    slug: value('slug'),
    version: value('version'),
    title: value('title'),
    canonicalUrl: value('canonical_url'),
    socialImage: value('social_image'),
    social,
  }
}

export function validatePiece(piece) {
  const errors = []
  if (new URL(piece.canonicalUrl).pathname.replace(/\/$/, '') !== `/pieces/${piece.slug}`)
    errors.push('canonical_url does not match the piece slug')
  if (!/^\/pieces\/[^/]+\/social-card(?:-[a-z0-9]+)?\.png$/i.test(piece.socialImage))
    errors.push('social_image must be a versionable PNG social card path')

  const entries = Object.entries(piece.social)
  if (!entries.length) errors.push('social_post does not opt into any platform')
  for (const [platform, caption] of entries) {
    const limit = platform === 'x' ? 280 : 3000
    if (!caption) errors.push(`${platform} caption is empty`)
    if (caption.length > limit) errors.push(`${platform} caption is ${caption.length}/${limit} characters`)
    if (!caption.includes(piece.canonicalUrl)) errors.push(`${platform} caption must include canonical_url`)
    if (/^>\s/m.test(caption)) errors.push(`${platform} caption must not contain quoted-post prefixes`)
  }
  if (errors.length) throw new Error(errors.join('; '))
  return entries.map(([platform]) => platform)
}

export function metaMap(html) {
  const result = new Map()
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = new Map()
    for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gi))
      attributes.set(match[1].toLowerCase(), match[3])
    const key = attributes.get('property') ?? attributes.get('name')
    if (key && attributes.has('content')) result.set(key.toLowerCase(), attributes.get('content'))
  }
  return result
}

export function inspectPng(data) {
  if (data.length < 29 || !data.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('social image is not a valid PNG')
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    bitDepth: data.readUInt8(24),
  }
}

function sameUrl(left, right) {
  return left.replace(/\/$/, '') === right.replace(/\/$/, '')
}

async function fetchOk(url, options) {
  const response = await globalThis.fetch(url, {
    redirect: 'follow',
    signal: globalThis.AbortSignal.timeout(20_000),
    ...options,
  })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return response
}

export async function inspectProduction(piece, platform = 'x') {
  const userAgent = platform === 'linkedin' ? 'LinkedInBot/1.0' : 'Twitterbot/1.0'
  const page = await fetchOk(piece.canonicalUrl, { headers: { 'user-agent': userAgent } })
  if (!page.headers.get('content-type')?.includes('text/html')) throw new Error('canonical URL did not return HTML')

  const html = await page.text()
  const meta = metaMap(html)
  const expectedImage = new URL(piece.socialImage, piece.canonicalUrl).href
  const required = {
    'og:title': meta.get('og:title'),
    'og:description': meta.get('og:description'),
    'og:image': meta.get('og:image'),
    'og:image:alt': meta.get('og:image:alt'),
    'twitter:card': meta.get('twitter:card'),
    'twitter:image': meta.get('twitter:image'),
    'twitter:image:alt': meta.get('twitter:image:alt'),
  }
  for (const [name, content] of Object.entries(required))
    if (!content) throw new Error(`production page is missing ${name}`)
  if (!sameUrl(meta.get('og:url') ?? '', piece.canonicalUrl))
    throw new Error('production og:url does not match canonical_url')
  if (meta.get('og:image') !== expectedImage || meta.get('twitter:image') !== expectedImage)
    throw new Error(`production still serves a different social image (expected ${expectedImage})`)
  if (meta.get('og:image:type') !== 'image/png') throw new Error('og:image:type must be image/png')
  if (meta.get('og:image:width') !== '1200' || meta.get('og:image:height') !== '630')
    throw new Error('production social dimensions must be 1200x630')
  if (meta.get('twitter:card') !== 'summary_large_image') throw new Error('twitter:card must be summary_large_image')

  const image = await fetchOk(expectedImage, { headers: { 'user-agent': userAgent } })
  if (!image.headers.get('content-type')?.includes('image/png'))
    throw new Error('social image did not return image/png')
  const bytes = Buffer.from(await image.arrayBuffer())
  const png = inspectPng(bytes)
  if (png.width !== 1200 || png.height !== 630 || png.bitDepth !== 8)
    throw new Error(`social image is ${png.width}x${png.height} at ${png.bitDepth}-bit, expected 1200x630 at 8-bit`)

  return { image: expectedImage, bytes: bytes.length, userAgent }
}

export async function loadPiece(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`invalid piece slug ${JSON.stringify(slug)}`)
  return readPieceFrontmatter(await readFile(new URL(`../../content/pieces/${slug}.md`, import.meta.url), 'utf8'))
}
