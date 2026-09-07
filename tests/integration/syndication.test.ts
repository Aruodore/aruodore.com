import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pieceFiles = readdirSync('content/pieces').filter((name) => name.endsWith('.md'))
const sitemap = readFileSync('server/routes/sitemap.xml.ts', 'utf8')
const feed = readFileSync('server/routes/feed.xml.ts', 'utf8')

function frontmatter(file: string) {
  const source = readFileSync(`content/pieces/${file}`, 'utf8')
  const read = (key: string) => source.match(new RegExp(`^${key}: (.+)$`, 'm'))?.[1]?.trim() ?? ''
  return { slug: read('slug'), published: read('published'), summary: read('summary') }
}

describe('syndication covers every published piece', () => {
  it.each(pieceFiles)('%s appears in the sitemap', (file) => {
    expect(sitemap).toContain(`'/pieces/${frontmatter(file).slug}'`)
  })

  it.each(pieceFiles)('%s appears in the feed', (file) => {
    expect(feed).toContain(`https://aruodore.com/pieces/${frontmatter(file).slug}`)
  })

  /* The two oldest entries carry bespoke blurbs rather than the frontmatter
   * summary, and rewriting them would change entries subscribers already
   * hold, so only the date and the presence of a summary are asserted. */
  it('feed entries carry the published date and a summary', () => {
    for (const file of pieceFiles) {
      const { slug, published } = frontmatter(file)
      const at = feed.indexOf(`https://aruodore.com/pieces/${slug}`)
      const entry = feed.slice(Math.max(0, at - 400), at + 600)
      expect(entry, `${slug} date`).toContain(`${published}T00:00:00Z`)
      expect(entry, `${slug} summary`).toMatch(/summary:\s*\n?\s*'[^']{40,}'/)
    }
  })

  it('the feed timestamp is no older than the newest piece', () => {
    const newest = pieceFiles
      .map((file) => frontmatter(file).published)
      .sort()
      .at(-1)!
    const declared = feed.match(/<updated>\$\{?([0-9T:Z-]+)/)?.[1] ?? feed.match(/<updated>([0-9T:Z-]+)</)?.[1] ?? ''
    expect(declared.slice(0, 10) >= newest, `feed says ${declared}, newest piece is ${newest}`).toBe(true)
  })
})
