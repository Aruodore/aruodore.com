import { describe, expect, it } from 'vitest'
import {
  bivariateNormalDensity,
  clampGibbsParameters,
  conditionalStandardDeviation,
  gibbsSweep,
  sampleCorrelation,
  theoreticalEfficiency,
} from '../../pieces/gibbs-sampling/model'

describe('gibbs sampling model', () => {
  it('uses the analytic Gaussian full conditionals', () => {
    const state = { x: 10, y: 2 }
    const sweep = gibbsSweep(state, 0, 0, 0.5)
    expect(sweep.intermediate).toEqual({ x: 1, y: 2 })
    expect(sweep).toMatchObject({ x: 1, y: 0.5 })
    expect(conditionalStandardDeviation(0.5)).toBeCloseTo(Math.sqrt(0.75))
  })

  it('recovers the requested target moments by simulation', () => {
    let seed = 17
    const uniform = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const normal = () =>
      Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, uniform()))) * Math.cos(2 * Math.PI * uniform())
    let state = { x: 0, y: 0 }
    const xs: number[] = []
    const ys: number[] = []
    for (let index = 0; index < 80_000; index += 1) {
      state = gibbsSweep(state, normal(), normal(), 0.72)
      if (index > 1000) {
        xs.push(state.x)
        ys.push(state.y)
      }
    }
    expect(sampleCorrelation(xs, ys)).toBeCloseTo(0.72, 1)
    expect(xs.reduce((sum, value) => sum + value, 0) / xs.length).toBeCloseTo(0, 1)
  })

  it('has a normalized density and the expected efficiency limits', () => {
    const steps = 400
    const width = 10 / steps
    let mass = 0
    for (let i = 0; i < steps; i += 1) {
      for (let j = 0; j < steps; j += 1) {
        mass += bivariateNormalDensity(-5 + (i + 0.5) * width, -5 + (j + 0.5) * width, 0.7) * width * width
      }
    }
    expect(mass).toBeCloseTo(1, 4)
    expect(theoreticalEfficiency(0)).toBe(1)
    expect(theoreticalEfficiency(0.95)).toBeCloseTo(0.05125, 4)
    expect(theoreticalEfficiency(-0.95)).toBeCloseTo(theoreticalEfficiency(0.95))
  })

  it('clamps correlation inside a nonsingular target', () => {
    expect(clampGibbsParameters({ rho: 0.5 }, { rho: 2 })).toEqual({ rho: 0.98 })
    expect(clampGibbsParameters({ rho: 0.5 }, { rho: -2 })).toEqual({ rho: -0.98 })
    expect(clampGibbsParameters({ rho: 0.5 }, {})).toEqual({ rho: 0.5 })
  })
})
