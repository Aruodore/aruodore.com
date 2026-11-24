import { describe, it, expect } from 'vitest'
import {
  createRecord,
  coordinateStep,
  divergence,
  DEFAULT_SETTINGS,
  TARGET_MEAN,
} from '../../pieces/variational-inference/model'
describe('mean-field variational inference', () => {
  it('has zero KL for the independent target and the analytic nonzero optimum for correlated targets', () => {
    expect(divergence({ mean: TARGET_MEAN, variance: [1, 1] }, 0)).toBe(0)
    for (const rho of [0.5, 0.85, 0.95]) {
      const v = 1 - rho * rho
      expect(divergence({ mean: TARGET_MEAN, variance: [v, v] }, rho)).toBeCloseTo(-0.5 * Math.log(v), 12)
      expect(divergence({ mean: TARGET_MEAN, variance: [1, 1] }, rho)).toBeGreaterThan(-0.5 * Math.log(v))
    }
  })
  it.each([0, 0.5, 0.85, 0.95])('decreases the objective at every step fraction at rho=%s', (correlation) => {
    for (const rate of [0.1, 0.5, 1]) {
      const record = createRecord({ ...DEFAULT_SETTINGS, correlation, rate, iteration: 40 })
      record.kl.forEach((kl, i) => {
        expect(kl).toBeGreaterThanOrEqual(record.optimumKl - 1e-10)
        if (i) expect(kl).toBeLessThanOrEqual(record.kl[i - 1]! + 1e-10)
      })
      expect(record.current.variance.every((v) => v > 0)).toBe(true)
    }
  })
  it('preserves the optimum under further updates', () => {
    const q = { mean: TARGET_MEAN, variance: [0.36, 0.36] as [number, number] }
    expect(coordinateStep(q, 0.8, 1).mean).toEqual(TARGET_MEAN)
    expect(coordinateStep(q, 0.8, 1).variance[0]).toBeCloseTo(0.36, 12)
  })
})
