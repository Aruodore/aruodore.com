import { describe, expect, it } from 'vitest'
import {
  averageSd,
  backSubstitute,
  cholesky,
  clampGpParameters,
  createSeededRandom,
  drawObservation,
  forwardSubstitute,
  GP_DOMAIN,
  gpPosterior,
  initialObservations,
  INITIAL_INPUTS,
  linspace,
  samplePath,
  squaredExponential,
  standardNormalVector,
  Z_95,
} from '../../pieces/gaussian-process-regression/model'

const parameters = { lengthScale: 1, noise: 0.2 }

describe('gaussian process regression model', () => {
  it('evaluates the squared-exponential kernel', () => {
    expect(squaredExponential(2, 2, 1)).toBe(1)
    expect(squaredExponential(0, 1, 1)).toBeCloseTo(Math.exp(-0.5))
    expect(squaredExponential(0, 2, 2, 3)).toBeCloseTo(9 * Math.exp(-0.5))
    expect(Z_95).toBeCloseTo(1.96, 2)
  })

  it('factorises and solves with triangular systems', () => {
    const A = Float64Array.from([4, 2, 2, 3])
    const L = cholesky(A, 2)
    expect(Array.from(L)).toEqual([2, 0, 1, Math.SQRT2])
    const b = Float64Array.from([2, 1])
    const x = backSubstitute(L, forwardSubstitute(L, b, 2), 2)
    expect(4 * x[0]! + 2 * x[1]!).toBeCloseTo(2)
    expect(2 * x[0]! + 3 * x[1]!).toBeCloseTo(1)
  })

  it('zeroes a column with no remaining variance instead of failing', () => {
    const L = cholesky(Float64Array.from([1, 1, 1, 1]), 2)
    expect(Array.from(L)).toEqual([1, 0, 1, 0])
  })

  it('returns the prior when there are no observations', () => {
    const posterior = gpPosterior([], parameters)
    expect(posterior.mean.every((value) => value === 0)).toBe(true)
    expect(posterior.sd.every((value) => Math.abs(value - 1) < 1e-12)).toBe(true)
    expect(posterior.logMarginalLikelihood).toBe(0)
    expect(averageSd(posterior)).toBeCloseTo(1)
  })

  it('matches the closed-form posterior for a single observation', () => {
    const grid = Float64Array.from([3, 4])
    const noise = 0.5
    const posterior = gpPosterior([{ x: 3, y: 2 }], { lengthScale: 1, noise }, grid)
    const shrink = 1 / (1 + noise ** 2)
    const k = Math.exp(-0.5)
    expect(posterior.mean[0]).toBeCloseTo(2 * shrink)
    expect(posterior.mean[1]).toBeCloseTo(2 * k * shrink)
    expect(posterior.sd[0]).toBeCloseTo(Math.sqrt(1 - shrink))
    expect(posterior.sd[1]).toBeCloseTo(Math.sqrt(1 - k * k * shrink))
    const variance = 1 + noise ** 2
    expect(posterior.logMarginalLikelihood).toBeCloseTo(
      -0.5 * (4 / variance) - 0.5 * Math.log(variance) - 0.5 * Math.log(2 * Math.PI),
    )
  })

  it('narrows the band near data and relaxes it far away', () => {
    const grid = linspace(GP_DOMAIN.min, GP_DOMAIN.max, 101)
    const posterior = gpPosterior([{ x: 1, y: 0.5 }], parameters, grid)
    expect(posterior.sd[10]!).toBeLessThan(0.25)
    expect(posterior.sd[100]!).toBeCloseTo(1, 6)
    expect(posterior.mean[100]!).toBeCloseTo(0, 6)
  })

  it('draws finite sample paths whose great-circle endpoints coincide', () => {
    const posterior = gpPosterior(initialObservations(1), parameters)
    const random = createSeededRandom(4)
    const z1 = standardNormalVector(posterior.mean.length, random)
    const z2 = standardNormalVector(posterior.mean.length, random)
    const start = samplePath(posterior, z1, z2, 0)
    const lap = samplePath(posterior, z1, z2, 2 * Math.PI)
    expect(start.every(Number.isFinite)).toBe(true)
    for (let i = 0; i < start.length; i += 1) expect(lap[i]).toBeCloseTo(start[i]!, 9)
  })

  it('keeps sample paths finite for the tightest supported settings', () => {
    const posterior = gpPosterior(initialObservations(1), { lengthScale: 0.3, noise: 0.02 })
    const random = createSeededRandom(9)
    const z = standardNormalVector(posterior.mean.length, random)
    expect(samplePath(posterior, z, z, 1).every(Number.isFinite)).toBe(true)
  })

  it('generates reproducible observations inside the domain', () => {
    expect(initialObservations(3)).toEqual(initialObservations(3))
    expect(initialObservations(3).map((observation) => observation.x)).toEqual([...INITIAL_INPUTS])
    const random = createSeededRandom(5)
    for (let i = 0; i < 50; i += 1) {
      const { x } = drawObservation(random)
      expect(x).toBeGreaterThanOrEqual(GP_DOMAIN.min)
      expect(x).toBeLessThan(GP_DOMAIN.max)
    }
  })

  it('clamps hyperparameters to the supported ranges', () => {
    expect(clampGpParameters(parameters, { lengthScale: 0.01, noise: 4 })).toEqual({ lengthScale: 0.3, noise: 1 })
    expect(clampGpParameters(parameters, {})).toEqual(parameters)
    expect(linspace(0, 1, 1)[0]).toBe(0)
  })
})
