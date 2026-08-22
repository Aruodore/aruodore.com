/*
 * Beta-binomial conjugate model.
 *
 * An unknown success probability p carries a beta prior
 *
 *     p ~ Beta(alpha0, beta0),
 *
 *     f(p) = p^(alpha0-1) (1-p)^(beta0-1) / B(alpha0, beta0).
 *
 * Each trial is an independent Bernoulli(p) draw. After n trials with
 * s successes the likelihood is proportional to p^s (1-p)^(n-s), which
 * has the same functional form as the prior. Multiplying the two and
 * renormalising therefore returns another beta density
 *
 *     p | data ~ Beta(alpha0 + s, beta0 + n - s).
 *
 * That closure under updating is conjugacy: the posterior needs no
 * integration, only two additions. The prior parameters act as counts
 * of imagined prior successes and failures, so alpha0 + beta0 is the
 * prior's effective sample size measured in trials.
 */

export interface BetaBinomialParameters {
  alpha0: number
  beta0: number
  theta: number
}

export interface BetaParameters {
  alpha: number
  beta: number
}

export interface CredibleInterval {
  lower: number
  upper: number
}

/* Slider ranges. Exported so the interactive controls and the clamp
 * below cannot drift apart. Shape parameters stay at or above 0.5:
 * the density diverges at an endpoint once a shape falls under 1, and
 * 0.5 keeps that divergence (the Jeffreys prior) plottable. */
export const BETA_BINOMIAL_LIMITS = {
  alpha0: { min: 0.5, max: 20 },
  beta0: { min: 0.5, max: 20 },
  theta: { min: 0, max: 1 },
} as const

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function clampBetaBinomialParameters(
  current: BetaBinomialParameters,
  next: Partial<BetaBinomialParameters>,
): BetaBinomialParameters {
  const limits = BETA_BINOMIAL_LIMITS
  return {
    alpha0: next.alpha0 === undefined ? current.alpha0 : clamp(next.alpha0, limits.alpha0.min, limits.alpha0.max),
    beta0: next.beta0 === undefined ? current.beta0 : clamp(next.beta0, limits.beta0.min, limits.beta0.max),
    theta: next.theta === undefined ? current.theta : clamp(next.theta, limits.theta.min, limits.theta.max),
  }
}

/* Lanczos approximation to log Γ(x) with g = 7 and nine coefficients,
 * accurate to roughly 15 significant digits on the positive axis. Only
 * the logarithm is computed: Γ(alpha) overflows for the sample sizes
 * this piece reaches, while log Γ stays well scaled. */
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
]

export function logGamma(x: number): number {
  // Reflection formula Γ(x)Γ(1-x) = π / sin(πx) moves small arguments
  // into the range where the series converges.
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  const z = x - 1
  let series = 0
  LANCZOS.forEach((coefficient, index) => {
    series += index === 0 ? coefficient : coefficient / (z + index)
  })
  const t = z + LANCZOS.length - 1.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(series)
}

/* log B(a, b) = log Γ(a) + log Γ(b) - log Γ(a + b). */
export function logBeta(alpha: number, beta: number): number {
  return logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta)
}

/* Beta density. The endpoints are exact rather than approximate: for a
 * shape below 1 the density diverges, at exactly 1 it takes the value
 * of the opposite shape, and above 1 it vanishes. */
export function betaDensity(x: number, alpha: number, beta: number): number {
  if (x < 0 || x > 1 || alpha <= 0 || beta <= 0) return 0
  if (x === 0) {
    if (alpha < 1) return Number.POSITIVE_INFINITY
    return alpha === 1 ? beta : 0
  }
  if (x === 1) {
    if (beta < 1) return Number.POSITIVE_INFINITY
    return beta === 1 ? alpha : 0
  }
  return Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logBeta(alpha, beta))
}

const CONTINUED_FRACTION_ITERATIONS = 220
const CONTINUED_FRACTION_TOLERANCE = 3e-16
const TINY = 1e-300

/* Modified Lentz evaluation of the continued fraction for the
 * regularised incomplete beta function. Guards replace any vanishing
 * denominator with TINY, the standard fix for the fraction's
 * occasional zero partial quotient. */
function betaContinuedFraction(x: number, alpha: number, beta: number): number {
  const qab = alpha + beta
  const qap = alpha + 1
  const qam = alpha - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < TINY) d = TINY
  d = 1 / d
  let h = d
  for (let m = 1; m <= CONTINUED_FRACTION_ITERATIONS; m += 1) {
    const m2 = 2 * m
    // Even step of the recurrence.
    let numerator = (m * (beta - m) * x) / ((qam + m2) * (alpha + m2))
    d = 1 + numerator * d
    if (Math.abs(d) < TINY) d = TINY
    c = 1 + numerator / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    h *= d * c
    // Odd step of the recurrence.
    numerator = (-(alpha + m) * (qab + m) * x) / ((alpha + m2) * (qap + m2))
    d = 1 + numerator * d
    if (Math.abs(d) < TINY) d = TINY
    c = 1 + numerator / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < CONTINUED_FRACTION_TOLERANCE) break
  }
  return h
}

/* Beta cumulative distribution function, that is the regularised
 * incomplete beta function I_x(alpha, beta). The continued fraction
 * converges quickly only on one side of the mode, so arguments past
 * (alpha+1)/(alpha+beta+2) use the symmetry
 *
 *     I_x(alpha, beta) = 1 - I_(1-x)(beta, alpha).
 */
export function betaCdf(x: number, alpha: number, beta: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const front = Math.exp(alpha * Math.log(x) + beta * Math.log(1 - x) - logBeta(alpha, beta))
  if (x < (alpha + 1) / (alpha + beta + 2)) {
    return clamp((front * betaContinuedFraction(x, alpha, beta)) / alpha, 0, 1)
  }
  return clamp(1 - (front * betaContinuedFraction(1 - x, beta, alpha)) / beta, 0, 1)
}

const QUANTILE_ITERATIONS = 90

/* Beta quantile by bisection on the CDF. The CDF is continuous and
 * strictly increasing on (0, 1), so bisection is unconditionally
 * convergent; 90 halvings of the unit interval reach machine precision
 * with no derivative and no failure mode worth handling. */
export function betaQuantile(probability: number, alpha: number, beta: number): number {
  if (probability <= 0) return 0
  if (probability >= 1) return 1
  let lower = 0
  let upper = 1
  for (let iteration = 0; iteration < QUANTILE_ITERATIONS; iteration += 1) {
    const middle = 0.5 * (lower + upper)
    if (betaCdf(middle, alpha, beta) < probability) lower = middle
    else upper = middle
  }
  return 0.5 * (lower + upper)
}

/* Equal-tailed credible interval: the central `mass` of the posterior,
 * with (1 - mass)/2 excluded in each tail. Equal-tailed rather than
 * highest-density, because it is the interval the quantiles give
 * directly and it is invariant under monotone reparameterisation. */
export function betaCredibleInterval(alpha: number, beta: number, mass = 0.95): CredibleInterval {
  const tail = 0.5 * (1 - mass)
  return {
    lower: betaQuantile(tail, alpha, beta),
    upper: betaQuantile(1 - tail, alpha, beta),
  }
}

/* Posterior mean E[p | data] = alpha / (alpha + beta). This is also the
 * posterior predictive probability that the next trial is a success,
 * since Pr(next success) = E[p | data] by conditioning on p. */
export function betaMean(alpha: number, beta: number): number {
  return alpha / (alpha + beta)
}

/* Var[p] = alpha beta / ((alpha+beta)^2 (alpha+beta+1)). The posterior
 * effective sample size alpha+beta appears in the denominator, so the
 * standard deviation shrinks at the familiar 1/sqrt(n) rate. */
export function betaStandardDeviation(alpha: number, beta: number): number {
  const total = alpha + beta
  return Math.sqrt((alpha * beta) / (total * total * (total + 1)))
}

/* The conjugate update itself: add successes to alpha, failures to beta. */
export function posteriorParameters(alpha0: number, beta0: number, successes: number, trials: number): BetaParameters {
  const failures = trials - successes
  return { alpha: alpha0 + successes, beta: beta0 + failures }
}

/* Effective sample size of a beta density, in trials. For the prior it
 * says how many observations the prior is worth; comparing it with n
 * says whether the prior or the data dominates the posterior. */
export function effectiveSampleSize(alpha: number, beta: number): number {
  return alpha + beta
}
