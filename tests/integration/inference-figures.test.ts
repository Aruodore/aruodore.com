import { describe, it, expect } from 'vitest'
import { createView as bo } from '../../pieces/bayesian-optimisation/figure'
import { DEFAULT_SETTINGS as boDefaults } from '../../pieces/bayesian-optimisation/model'
import { createView as pf } from '../../pieces/particle-filtering/figure'
import { DEFAULT_SETTINGS as pfDefaults } from '../../pieces/particle-filtering/model'
import { createView as vi } from '../../pieces/variational-inference/figure'
import { DEFAULT_SETTINGS as viDefaults } from '../../pieces/variational-inference/model'
describe('new inference figures', () => {
  it.each([
    ['optimisation', () => bo(boDefaults)],
    ['filtering', () => pf(pfDefaults)],
    ['variational', () => vi(viDefaults)],
  ] as const)('%s renders accessible SVG at both sizes', (_, create) => {
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
  it.each([
    ['optimisation', () => bo({ ...boDefaults, iterations: 6 }), 'mean'],
    ['filtering', () => pf({ ...pfDefaults, inspect: 13 }), 'rug-particle-0'],
    ['variational', () => vi({ ...viDefaults, iteration: 1 }), 'q-1'],
  ] as const)('%s updates persistent nodes through intermediate states', (_, create, key) => {
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
  })
})

describe('visible mathematical explanations', () => {
  it('keeps the VI error floor visible and stops only when fitting error is small', () => {
    const initial = vi(viDefaults)
    const final = vi({ ...viDefaults, iteration: 40 })
    expect(initial.complete).toBe(false)
    expect(final.complete).toBe(true)
    expect(initial.render(false)).toContain('Shaded floor: 0.641 nats')
    expect(final.stats.find((s) => s.label === 'Irreducible family error (nats)')!.value).toBe('0.6410')
    expect(Number(final.stats.find((s) => s.label === 'Unfinished optimisation (nats)')!.value)).toBeLessThan(0.01)
  })
  it('makes copying visible in the disclosed filter episode', () => {
    const view = pf(pfDefaults)
    expect(view.insight).toContain('17 distinct parents')
    const document = new DOMParser().parseFromString(view.render(false), 'image/svg+xml')
    expect(document.querySelectorAll('[data-motion^="copy-link-"]')).toHaveLength(160)
    expect(document.querySelectorAll('[data-motion^="parent-"]')).toHaveLength(160)
  })
})
