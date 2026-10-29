import { describe, expect, it } from 'vitest'
import {
  correct,
  createRecord,
  DEFAULT_SETTINGS,
  DT,
  predict,
  rmse,
  STEPS,
  transition,
} from '../../pieces/extended-kalman-filtering/model'

describe('nonlinear pendulum filtering', () => {
  it('uses the derivative of the actual transition to propagate covariance', () => {
    const mean: [number, number] = [1.2, 0.4]
    const eps = 1e-6
    const base = transition(mean)
    const shifted = transition([mean[0] + eps, mean[1]])
    expect((shifted[0] - base[0]) / eps).toBeCloseTo(1 - 4 * DT ** 2 * Math.cos(mean[0]), 5)
    expect((shifted[1] - base[1]) / eps).toBeCloseTo(-4 * DT * Math.cos(mean[0]), 5)
    expect(predict({ mean, cov: [1, 0, 0] }).cov[0]).toBeCloseTo(
      (1 - 4 * DT ** 2 * Math.cos(mean[0])) ** 2 + 0.002 ** 2,
    )
  })
  it('does not gain first-order angle information at a sensor turning point', () => {
    const belief = { mean: [Math.PI / 2, 0] as [number, number], cov: [0.5, 0.1, 0.4] as [number, number, number] }
    const updated = correct(belief, 0.8, 0.1)
    expect(updated.mean[0]).toBeCloseTo(belief.mean[0], 12)
    expect(updated.cov[0]).toBeCloseTo(belief.cov[0], 12)
  })
  it('reduces to scalar Gaussian conditioning for a linear position sensor', () => {
    const updated = correct({ mean: [0, 0], cov: [1, 0.5, 1] }, 2, 1, true)
    expect(updated.mean).toEqual([1, 0.5])
    expect(updated.cov).toEqual([0.5, 0.25, 0.875])
    expect(transition([1, 0], true)).toEqual([1 - 4 * DT ** 2, -4 * DT])
  })
  it('preserves the record when only inspection or assumed initial uncertainty changes', () => {
    const original = createRecord()
    expect(original).toHaveLength(STEPS)
    expect(createRecord()).toEqual(original)
    expect(createRecord({ ...DEFAULT_SETTINGS, inspect: 200 })).toEqual(original)
    const changed = createRecord({ ...DEFAULT_SETTINGS, uncertainty: 1 })
    expect(changed.map((s) => s.observation)).toEqual(original.map((s) => s.observation))
    expect(changed[0]!.filtered.mean).not.toEqual(original[0]!.filtered.mean)
    expect(createRecord({ ...DEFAULT_SETTINGS, seed: 43 })[0]!.observation).not.toBe(original[0]!.observation)
    expect(rmse(original, 'filtered')).toBeLessThan(rmse(original, 'linear'))
  })
  it.each([0.3, 1.5, 2.6])('keeps covariances positive at release angle %s', (angle) => {
    for (const step of createRecord({ ...DEFAULT_SETTINGS, angle, uncertainty: 1.2, noise: 0.02 })) {
      for (const belief of [step.predicted, step.filtered, step.linear]) {
        const [a, b, c] = belief.cov
        expect(belief.mean.every(Number.isFinite)).toBe(true)
        expect(a).toBeGreaterThan(0)
        expect(c).toBeGreaterThan(0)
        expect(a * c - b * b).toBeGreaterThanOrEqual(-1e-12)
      }
    }
  })
})
