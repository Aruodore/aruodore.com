import { describe, expect, it } from 'vitest'
import {
  BETA_BINOMIAL_LIMITS,
  betaCdf,
  betaCredibleInterval,
  betaDensity,
  betaMean,
  betaQuantile,
  betaStandardDeviation,
  clampBetaBinomialParameters,
  effectiveSampleSize,
  logBeta,
  logGamma,
  posteriorParameters,
} from '../../pieces/beta-binomial-update/model'

const factorial = (n: number) => Array.from({ length: n }, (_, i) => i + 1).reduce((a, b) => a * b, 1)

/* I_x(a, b) = Pr(Binomial(a + b - 1, x) >= a) for positive integers a, b.
 * An independent route to the same number, used to pin the continued
 * fraction rather than trusting it against itself. */
function binomialTail(trials: number, probability: number, atLeast: number) {
  let total = 0
  for (let k = atLeast; k <= trials; k += 1) {
    const choose = factorial(trials) / (factorial(k) * factorial(trials - k))
    total += choose * probability ** k * (1 - probability) ** (trials - k)
  }
  return total
}

describe('beta-binomial model', () => {
  it('computes log-gamma including the reflection branch', () => {
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 12)
    expect(logGamma(1)).toBeCloseTo(0, 12)
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 12)
    // x < 0.5 takes the reflection formula Γ(x)Γ(1-x) = π / sin(πx). At
    // x = 1/4 that gives the exact identity Γ(1/4)Γ(3/4) = π sqrt(2),
    // which pins the reflection branch against the ordinary one.
    expect(logGamma(0.25) + logGamma(0.75)).toBeCloseTo(Math.log(Math.PI * Math.SQRT2), 12)
    expect(logBeta(2, 3)).toBeCloseTo(Math.log(1 / 12), 12)
  })

  it('evaluates the beta density against closed forms', () => {
    expect(betaDensity(0.5, 1, 1)).toBeCloseTo(1, 12)
    // Beta(2, 3) density is 12 x (1-x)^2.
    expect(betaDensity(0.3, 2, 3)).toBeCloseTo(12 * 0.3 * 0.49, 12)
    expect(betaDensity(-0.1, 2, 2)).toBe(0)
    expect(betaDensity(1.1, 2, 2)).toBe(0)
    expect(betaDensity(0.5, 0, 2)).toBe(0)
  })

  it('handles the endpoints exactly, where shapes below one diverge', () => {
    expect(betaDensity(0, 0.5, 0.5)).toBe(Number.POSITIVE_INFINITY)
    expect(betaDensity(1, 0.5, 0.5)).toBe(Number.POSITIVE_INFINITY)
    expect(betaDensity(0, 1, 4)).toBe(4)
    expect(betaDensity(1, 3, 1)).toBe(3)
    expect(betaDensity(0, 2, 2)).toBe(0)
    expect(betaDensity(1, 2, 2)).toBe(0)
  })

  it('integrates to one over the unit interval', () => {
    const steps = 20_000
    let mass = 0
    for (let i = 0; i < steps; i += 1) mass += betaDensity((i + 0.5) / steps, 4.5, 2.5) / steps
    expect(mass).toBeCloseTo(1, 6)
  })

  it('matches the binomial tail identity for integer shapes', () => {
    for (const [alpha, beta, x] of [
      [3, 5, 0.7],
      [2, 3, 0.35],
      [12, 9, 0.42],
      [43, 21, 0.5],
    ] as const) {
      expect(betaCdf(x, alpha, beta)).toBeCloseTo(binomialTail(alpha + beta - 1, x, alpha), 10)
    }
  })

  it('anchors the cdf at the boundaries and on the uniform case', () => {
    expect(betaCdf(0.4, 1, 1)).toBeCloseTo(0.4, 12)
    expect(betaCdf(-1, 2, 2)).toBe(0)
    expect(betaCdf(0, 2, 2)).toBe(0)
    expect(betaCdf(1, 2, 2)).toBe(1)
    expect(betaCdf(2, 2, 2)).toBe(1)
    // Symmetric shapes put half the mass either side of 0.5.
    expect(betaCdf(0.5, 10, 10)).toBeCloseTo(0.5, 10)
  })

  it('inverts the cdf', () => {
    expect(betaQuantile(0.5, 7, 7)).toBeCloseTo(0.5, 8)
    expect(betaQuantile(0, 4, 2)).toBe(0)
    expect(betaQuantile(1, 4, 2)).toBe(1)
    for (const probability of [0.01, 0.25, 0.83, 0.99]) {
      expect(betaCdf(betaQuantile(probability, 4.5, 2.5), 4.5, 2.5)).toBeCloseTo(probability, 10)
    }
  })

  it('builds equal-tailed credible intervals', () => {
    // Under a uniform posterior the central 95% is simply [0.025, 0.975].
    const uniform = betaCredibleInterval(1, 1)
    expect(uniform.lower).toBeCloseTo(0.025, 8)
    expect(uniform.upper).toBeCloseTo(0.975, 8)

    const posterior = betaCredibleInterval(40, 24)
    expect(betaCdf(posterior.lower, 40, 24)).toBeCloseTo(0.025, 8)
    expect(betaCdf(posterior.upper, 40, 24)).toBeCloseTo(0.975, 8)
    expect(posterior.lower).toBeLessThan(betaMean(40, 24))
    expect(posterior.upper).toBeGreaterThan(betaMean(40, 24))

    // A narrower mass gives a strictly narrower interval.
    const eighty = betaCredibleInterval(40, 24, 0.8)
    expect(eighty.lower).toBeGreaterThan(posterior.lower)
    expect(eighty.upper).toBeLessThan(posterior.upper)
  })

  it('applies the conjugate update as pseudo-counts', () => {
    expect(posteriorParameters(2, 2, 38, 60)).toEqual({ alpha: 40, beta: 24 })
    // Updating trial by trial equals updating once with the totals.
    let sequential = { alpha: 2, beta: 2 }
    const outcomes = [1, 0, 1, 1, 0, 1, 1, 1, 0, 1]
    for (const outcome of outcomes) {
      sequential = posteriorParameters(sequential.alpha, sequential.beta, outcome, 1)
    }
    const successes = outcomes.reduce((a, b) => a + b, 0)
    expect(sequential).toEqual(posteriorParameters(2, 2, successes, outcomes.length))
  })

  it('reports the posterior mean, spread, and effective sample size', () => {
    expect(betaMean(40, 24)).toBeCloseTo(40 / 64, 12)
    // The posterior mean is the prior-weighted sample proportion.
    expect(betaMean(2 + 38, 2 + 22)).toBeCloseTo((2 + 38) / (2 + 2 + 60), 12)
    expect(betaStandardDeviation(1, 1)).toBeCloseTo(Math.sqrt(1 / 12), 12)
    expect(effectiveSampleSize(2, 2)).toBe(4)
    expect(effectiveSampleSize(40, 24)).toBe(64)
    // Spread contracts as the effective sample size grows.
    expect(betaStandardDeviation(400, 240)).toBeLessThan(betaStandardDeviation(40, 24))
  })

  it('clamps interactive parameters to the published slider ranges', () => {
    const current = { alpha0: 2, beta0: 2, theta: 0.62 }
    expect(clampBetaBinomialParameters(current, { alpha0: 99, beta0: 0, theta: 4 })).toEqual({
      alpha0: BETA_BINOMIAL_LIMITS.alpha0.max,
      beta0: BETA_BINOMIAL_LIMITS.beta0.min,
      theta: BETA_BINOMIAL_LIMITS.theta.max,
    })
    expect(clampBetaBinomialParameters(current, { theta: -1 })).toEqual({ ...current, theta: 0 })
    // Absent fields are left untouched rather than defaulted.
    expect(clampBetaBinomialParameters(current, {})).toEqual(current)
  })
})
