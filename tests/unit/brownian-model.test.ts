import { describe, expect, it } from 'vitest'
import { createNormalSampler } from '../../pieces/brownian-motion/box-muller'
import { brownianCoordinateVariance, brownianRmsRadius, brownianStepScale } from '../../pieces/brownian-motion/model'

describe('Brownian model', () => {
  it('scales steps and moments with sigma and time', () => {
    expect(brownianStepScale(2, 0.25)).toBe(1)
    expect(brownianCoordinateVariance(2, 3)).toBe(12)
    expect(brownianRmsRadius(2, 3)).toBe(6)
  })

  it('reuses the cached second Box–Muller sample', () => {
    const values = [Math.exp(-0.5), 0.25]
    let calls = 0
    const sample = createNormalSampler(() => values[calls++]!)
    expect(sample()).toBeCloseTo(0, 12)
    expect(sample()).toBeCloseTo(1, 12)
    expect(calls).toBe(2)
  })
})
