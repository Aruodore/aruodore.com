import { describe, expect, it } from 'vitest'
import {
  acceptanceProbability,
  autocorrelation,
  binIndex,
  clampMetropolisHastingsParameters,
  effectiveSampleSize,
  histogramDensity,
  metropolisStep,
  targetDensity,
  targetLogDensity,
  targetMean,
  targetStandardDeviation,
  TARGET_COMPONENTS,
  TARGET_DOMAIN,
} from '../../pieces/metropolis-hastings/model'

const TWO_COMPONENT_GRID = 20_000

function trapezoid(f: (x: number) => number, min: number, max: number, steps: number) {
  const width = (max - min) / steps
  let total = 0
  for (let index = 0; index <= steps; index += 1) {
    const weight = index === 0 || index === steps ? 0.5 : 1
    total += weight * f(min + index * width)
  }
  return total * width
}

describe('metropolis-hastings target', () => {
  it('is a normalised density with the analytic mixture moments', () => {
    // Integrated well beyond the plotted domain so the tails are included.
    expect(trapezoid((x) => targetDensity(x), -20, 20, TWO_COMPONENT_GRID)).toBeCloseTo(1, 5)
    expect(trapezoid((x) => x * targetDensity(x), -20, 20, TWO_COMPONENT_GRID)).toBeCloseTo(targetMean(), 4)
    const second = trapezoid((x) => x * x * targetDensity(x), -20, 20, TWO_COMPONENT_GRID)
    expect(Math.sqrt(second - targetMean() ** 2)).toBeCloseTo(targetStandardDeviation(), 4)
  })

  it('is bimodal inside the plotted domain', () => {
    const [first, second] = TARGET_COMPONENTS
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    const valley = (first!.mean + second!.mean) / 2
    expect(targetDensity(first!.mean)).toBeGreaterThan(targetDensity(valley))
    expect(targetDensity(second!.mean)).toBeGreaterThan(targetDensity(valley))
    expect(first!.mean).toBeGreaterThan(TARGET_DOMAIN.min)
    expect(second!.mean).toBeLessThan(TARGET_DOMAIN.max)
  })

  it('reports a finite log density where the density underflows', () => {
    expect(targetLogDensity(0)).toBeCloseTo(Math.log(targetDensity(0)))
    expect(targetLogDensity(1e6)).toBe(Number.NEGATIVE_INFINITY)
  })
})

describe('metropolis acceptance', () => {
  it('always accepts an uphill move and accepts a downhill move with the density ratio', () => {
    expect(acceptanceProbability(Math.log(0.2), Math.log(0.5))).toBe(1)
    expect(acceptanceProbability(Math.log(0.5), Math.log(0.2))).toBeCloseTo(0.4)
    expect(acceptanceProbability(Math.log(0.5), Number.NEGATIVE_INFINITY)).toBe(0)
    expect(acceptanceProbability(Number.NEGATIVE_INFINITY, Math.log(0.5))).toBe(1)
  })

  it('keeps the current state when a move is rejected', () => {
    const logDensity = (x: number) => -0.5 * x * x
    const state = { value: 0, logDensity: logDensity(0) }
    // Uphill is impossible from the mode, and a uniform of 0.99 exceeds
    // the acceptance probability of a two-unit step.
    const rejected = metropolisStep(state, 2, 0.99, 1, logDensity)
    expect(rejected.accepted).toBe(false)
    expect(rejected.value).toBe(0)
    expect(rejected.proposal).toBe(2)
    expect(rejected.logDensity).toBe(state.logDensity)
  })

  it('moves to the proposal when the move is accepted', () => {
    const logDensity = (x: number) => -0.5 * x * x
    const accepted = metropolisStep({ value: 2, logDensity: logDensity(2) }, -2, 0.5, 1, logDensity)
    expect(accepted.accepted).toBe(true)
    expect(accepted.value).toBe(0)
    expect(accepted.logDensity).toBeCloseTo(0)
  })

  it('recovers the target by simulation', () => {
    let state = { value: -3, logDensity: targetLogDensity(-3) }
    let seed = 7
    const uniform = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const normal = () => {
      const radius = Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, uniform())))
      return radius * Math.cos(2 * Math.PI * uniform())
    }
    let sum = 0
    const draws = 60_000
    for (let index = 0; index < draws; index += 1) {
      const step = metropolisStep(state, normal(), uniform(), 1.4)
      state = { value: step.value, logDensity: step.logDensity }
      sum += state.value
    }
    // A finite correlated chain, so this is a loose but meaningful check
    // that the stationary distribution is the intended target.
    expect(sum / draws).toBeCloseTo(targetMean(), 1)
  })

  it('clamps the proposal width to its declared range', () => {
    expect(clampMetropolisHastingsParameters({ proposalSd: 1 }, { proposalSd: 40 })).toEqual({ proposalSd: 4 })
    expect(clampMetropolisHastingsParameters({ proposalSd: 1 }, { proposalSd: 0 })).toEqual({ proposalSd: 0.05 })
    expect(clampMetropolisHastingsParameters({ proposalSd: 1 }, {})).toEqual({ proposalSd: 1 })
  })
})

describe('chain diagnostics', () => {
  it('reports full autocorrelation for a chain that never moves', () => {
    expect(autocorrelation([2, 2, 2, 2], 1)).toBe(1)
    expect(effectiveSampleSize([2, 2, 2, 2])).toBe(1)
  })

  it('measures lag-one dependence', () => {
    const alternating = Array.from({ length: 200 }, (_, index) => (index % 2 === 0 ? 1 : -1))
    expect(autocorrelation(alternating, 1)).toBeLessThan(-0.9)
    expect(autocorrelation(alternating, 2)).toBeGreaterThan(0.9)
    expect(autocorrelation(alternating, 500)).toBe(0)
  })

  it('gives an effective sample size near n for independent draws and far below n for a sticky chain', () => {
    let seed = 11
    const uniform = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const independent = Array.from({ length: 4000 }, () => uniform())
    expect(effectiveSampleSize(independent)).toBeGreaterThan(3200)

    // A first-order autoregressive chain with coefficient phi has
    // integrated autocorrelation time (1 + phi)/(1 - phi), which is 39 at
    // phi = 0.95, so 4000 draws are worth roughly 103 independent ones.
    let value = 0
    const sticky = Array.from({ length: 4000 }, () => {
      value = 0.95 * value + (uniform() - 0.5)
      return value
    })
    const ess = effectiveSampleSize(sticky)
    expect(ess).toBeGreaterThan(50)
    expect(ess).toBeLessThan(220)
  })

  it('never reports fewer than one or more than n effective draws', () => {
    expect(effectiveSampleSize([])).toBe(0)
    expect(effectiveSampleSize([1])).toBe(1)
    expect(effectiveSampleSize([1, 5])).toBeLessThanOrEqual(2)
  })
})

describe('histogram binning', () => {
  it('places values in bins and rejects values outside the domain', () => {
    expect(binIndex(-5, -5, 5, 10)).toBe(0)
    expect(binIndex(0, -5, 5, 10)).toBe(5)
    expect(binIndex(5, -5, 5, 10)).toBe(9)
    expect(binIndex(5.1, -5, 5, 10)).toBe(-1)
    expect(binIndex(Number.NaN, -5, 5, 10)).toBe(-1)
  })

  it('normalises counts to a density that integrates to one', () => {
    const counts = [2, 6, 12, 4]
    const densities = histogramDensity(counts, 24, 0.5)
    expect(densities.reduce((total, value) => total + value * 0.5, 0)).toBeCloseTo(1)
    expect(histogramDensity(counts, 0, 0.5)).toEqual([0, 0, 0, 0])
  })
})
