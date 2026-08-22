import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('content component resolution', () => {
  it.each([
    ['content/pieces/brownian-motion.md', '::brownian-motion'],
    ['content/pieces/ornstein-uhlenbeck.md', '::ornstein-uhlenbeck'],
    ['content/pieces/first-passage.md', '::first-passage'],
    ['content/pieces/beta-binomial-update.md', '::beta-binomial-update'],
  ])('%s uses a registered kebab-case MDC component', (contentPath, embed) => {
    const content = readFileSync(contentPath, 'utf8')
    const page = readFileSync('pages/pieces/[slug].vue', 'utf8')
    expect(content).toContain(embed)
    expect(page).toContain(`'${embed.slice(2)}':`)
  })

  it('maps the live sketch to its kebab-case file', () => {
    const page = readFileSync('pages/sketches/[slug].vue', 'utf8')
    expect(page).toContain("'ornstein-uhlenbeck':")
    expect(page).toContain('ornstein-uhlenbeck-sketch.vue')
  })
})
