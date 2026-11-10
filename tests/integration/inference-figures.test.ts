import { describe, it, expect } from 'vitest'
import { createView as bo } from '../../pieces/bayesian-optimisation/figure'
import { DEFAULT_SETTINGS as boDefaults } from '../../pieces/bayesian-optimisation/model'
describe('new inference figures', () => {
  it.each([['optimisation', () => bo(boDefaults)]] as const)('%s renders accessible SVG at both sizes', (_, create) => {
    const view = create()
    for (const mobile of [false, true]) {
      const svg = view.render(mobile)
      expect(svg).not.toMatch(/NaN|Infinity|undefined/)
      expect(svg).toContain('role="img" aria-labelledby=')
      expect(svg).toContain('<desc ')
      const xml = new DOMParser().parseFromString(svg, 'image/svg+xml')
      expect(xml.querySelector('parsererror')).toBeNull()
    }
  })
})

describe('continuous inference motion', () => {
  it.each([['optimisation', () => bo({ ...boDefaults, iterations: 6 }), 'mean']] as const)(
    '%s updates persistent nodes through intermediate states',
    (_, create, key) => {
      const view = create()
      for (const mobile of [false, true]) {
        const host = document.createElement('div')
        host.innerHTML = view.render(mobile)
        const svg = host.querySelector('svg')!
        const tracked = svg.querySelector(`[data-motion="${key}"]`)!
        expect(tracked).not.toBeNull()
        const frame = view.motion!(svg, mobile)
        const states = new Set<string>()
        for (let i = 0; i <= 20; i++) {
          frame(i / 20)
          expect(svg.innerHTML).not.toMatch(/NaN|Infinity|undefined/)
          expect(svg.querySelector(`[data-motion="${key}"]`)).toBe(tracked)
          states.add(tracked.outerHTML)
        }
        expect(states.size).toBeGreaterThan(5)
        expect(view.statsAt!(1)).toEqual(view.stats)
      }
    },
  )
})
