import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface VercelConfig {
  buildCommand?: string
}

describe('deployment', () => {
  // Vercel's Nuxt preset defaults to `nuxt build`, which deploys a server
  // function. Unknown URLs then reached that function and returned 500.
  it('builds the static site on Vercel so unknown URLs get the generated 404 page', () => {
    expect(existsSync('vercel.json')).toBe(true)
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as VercelConfig
    expect(config.buildCommand).toBe('npm run generate')
  })
})
