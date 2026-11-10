import { describe, it, expect } from 'vitest'
import {
  createRecord,
  DEFAULT_SETTINGS,
  expectedImprovement,
  normalCdf,
  normalPdf,
  predict,
  NUGGET,
} from '../../pieces/bayesian-optimisation/model'
describe('Bayesian optimisation', () => {
  it('matches numerical integration of positive improvement under a Gaussian', () => {
    for (const [mean, sd, best, margin] of [
      [0, 1, 0, 0],
      [-1, 0.5, 0.2, 0.1],
      [1, 0.4, 0.5, 0.2],
    ]) {
      let numerical = 0
      for (let z = -9; z <= 9; z += 0.002)
        numerical += Math.max(0, mean! + sd! * z - best! - margin!) * normalPdf(z) * 0.002
      expect(expectedImprovement(mean!, sd!, best!, margin!)).toBeCloseTo(numerical, 5)
    }
    expect(expectedImprovement(2, 0, 1, 0.2)).toBeCloseTo(0.8)
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
    expect(normalCdf(-8)).toBeLessThan(1e-12)
  })
  it('agrees with scalar Gaussian conditioning for one observation', () => {
    const p = predict([{ x: 2, y: 3 }], 1, [2, 3])
    expect(p[0]!.mean).toBeCloseTo(3 / (1 + NUGGET), 10)
    expect(p[1]!.mean).toBeCloseTo((3 * Math.exp(-0.5)) / (1 + NUGGET), 10)
    expect(p[1]!.sd ** 2).toBeCloseTo(1 - Math.exp(-1) / (1 + NUGGET), 10)
  })
  it('chooses the uncertain candidate over the high-mean alternative in the opening comparison', () => {
    const r = createRecord()
    const choice = r.posterior[Math.round(r.nextX * 12)]!
    const alternative = r.posterior
      .filter((p) => !r.observations.some((o) => Math.abs(o.x - p.x) < 1e-8))
      .reduce((a, b) => (a.mean > b.mean ? a : b))
    expect(choice.mean).toBeLessThan(alternative.mean)
    expect(choice.sd).toBeGreaterThan(alternative.sd)
    expect(r.acquisition[Math.round(choice.x * 12)]!).toBeGreaterThan(r.acquisition[Math.round(alternative.x * 12)]!)
  })
  it('replays a deterministic policy without repeated evaluations or a falling incumbent', () => {
    const short = createRecord({ ...DEFAULT_SETTINGS, iterations: 6 })
    const full = createRecord({ ...DEFAULT_SETTINGS, iterations: 18 })
    expect(full.observations.slice(0, 6)).toEqual(short.observations)
    expect(new Set(full.observations.map((p) => p.x)).size).toBe(18)
    expect(full.observations.some((p) => p.x === full.nextX)).toBe(false)
    expect(full.acquisition.every((x) => Number.isFinite(x) && x >= 0)).toBe(true)
    expect(full.history.every((x, i) => i === 0 || x >= full.history[i - 1]!)).toBe(true)
  })
})
