import { describe, expect, it } from 'vitest'
import { inspectPng, metaMap, readPieceFrontmatter, validatePiece } from '../../scripts/lib/social-release.mjs'

const markdown = `---
title: Gibbs Sampling
slug: gibbs-sampling
version: 1.0.0
canonical_url: https://aruodore.com/pieces/gibbs-sampling
social_image: /pieces/gibbs-sampling/social-card-v2.png
social_post:
  x: |-
    Gibbs sampling moves one variable at a time.

    https://aruodore.com/pieces/gibbs-sampling
---
`

describe('social release metadata', () => {
  it('reads opted-in copy from piece frontmatter', () => {
    const piece = readPieceFrontmatter(markdown)
    expect(piece.social.x).toContain('Gibbs sampling')
    expect(validatePiece(piece)).toEqual(['x'])
  })

  it('rejects quoted-post prefixes and missing canonical links', () => {
    const piece = readPieceFrontmatter(markdown)
    piece.social.x = '> Launching this now'
    expect(() => validatePiece(piece)).toThrow(/canonical_url.*quoted-post prefixes/)
  })

  it('reads meta attributes regardless of their order', () => {
    const meta = metaMap(
      `<meta content="card.png" property="og:image"><meta name='twitter:card' content='summary_large_image'>`,
    )
    expect(meta.get('og:image')).toBe('card.png')
    expect(meta.get('twitter:card')).toBe('summary_large_image')
  })

  it('reads dimensions and bit depth from a PNG header', () => {
    const png = Buffer.alloc(29)
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png)
    png.writeUInt32BE(1200, 16)
    png.writeUInt32BE(630, 20)
    png.writeUInt8(8, 24)
    expect(inspectPng(png)).toEqual({ width: 1200, height: 630, bitDepth: 8 })
  })
})
