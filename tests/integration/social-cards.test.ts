import { readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const contentDirectory = 'content/pieces'

describe('piece social cards', () => {
  for (const filename of readdirSync(contentDirectory).filter((name) => name.endsWith('.md'))) {
    it(`${filename} uses a valid 1200x630 PNG`, () => {
      const content = readFileSync(join(contentDirectory, filename), 'utf8')
      const socialImage = content.match(/^social_image:\s*(\S+)$/m)?.[1]

      expect(socialImage, `${filename} must define social_image`).toMatch(
        /^\/pieces\/[^/]+\/social-card(?:-[a-z0-9]+)?\.png$/,
      )

      const image = readFileSync(join('public', socialImage!))
      expect(image.subarray(1, 4).toString('ascii')).toBe('PNG')
      expect(image.readUInt32BE(16), `${basename(filename)} social card width`).toBe(1200)
      expect(image.readUInt32BE(20), `${basename(filename)} social card height`).toBe(630)
      expect(image.readUInt8(24), `${basename(filename)} social card bit depth`).toBe(8)
    })
  }

  it('publishes explicit Open Graph and X image metadata', () => {
    const page = readFileSync('pages/pieces/[slug].vue', 'utf8')

    expect(page).toContain("property: 'og:image'")
    expect(page).toContain("property: 'og:image:width', content: '1200'")
    expect(page).toContain("property: 'og:image:height', content: '630'")
    expect(page).toContain("name: 'twitter:image'")
  })
})
