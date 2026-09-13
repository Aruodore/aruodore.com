/* Gibbs sampling for a centred bivariate normal target,
 *
 *   (X, Y) ~ N(0, [[1, rho], [rho, 1]]).
 *
 * Its full conditionals are univariate normals,
 *
 *   X | Y=y ~ N(rho y, 1-rho^2),
 *   Y | X=x ~ N(rho x, 1-rho^2).
 *
 * A systematic sweep samples X first and then Y. Each draw is exact
 * from its conditional law, but successive sweeps become strongly
 * dependent as |rho| approaches one.
 */

export const GIBBS_LIMITS = {
  rho: { min: -0.98, max: 0.98 },
} as const

export const GIBBS_DOMAIN = { min: -3.5, max: 3.5 } as const

export interface GibbsParameters {
  rho: number
}

export interface GibbsState {
  x: number
  y: number
}

export interface GibbsSweep extends GibbsState {
  intermediate: GibbsState
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function clampGibbsParameters(current: GibbsParameters, next: Partial<GibbsParameters>): GibbsParameters {
  return {
    rho: next.rho === undefined ? current.rho : clamp(next.rho, GIBBS_LIMITS.rho.min, GIBBS_LIMITS.rho.max),
  }
}

export function conditionalStandardDeviation(rho: number): number {
  return Math.sqrt(Math.max(0, 1 - rho * rho))
}

export function gibbsSweep(state: GibbsState, zX: number, zY: number, rho: number): GibbsSweep {
  const sd = conditionalStandardDeviation(rho)
  const x = rho * state.y + sd * zX
  const intermediate = { x, y: state.y }
  const y = rho * x + sd * zY
  return { x, y, intermediate }
}

export function bivariateNormalDensity(x: number, y: number, rho: number): number {
  const determinant = Math.max(Number.EPSILON, 1 - rho * rho)
  const exponent = -(x * x - 2 * rho * x * y + y * y) / (2 * determinant)
  return Math.exp(exponent) / (2 * Math.PI * Math.sqrt(determinant))
}

export function sampleCorrelation(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return 0
  let meanX = 0
  let meanY = 0
  for (let index = 0; index < n; index += 1) {
    meanX += xs[index] ?? 0
    meanY += ys[index] ?? 0
  }
  meanX /= n
  meanY /= n
  let covariance = 0
  let varianceX = 0
  let varianceY = 0
  for (let index = 0; index < n; index += 1) {
    const dx = (xs[index] ?? 0) - meanX
    const dy = (ys[index] ?? 0) - meanY
    covariance += dx * dy
    varianceX += dx * dx
    varianceY += dy * dy
  }
  const denominator = Math.sqrt(varianceX * varianceY)
  return denominator > 0 ? covariance / denominator : 0
}

export function autocorrelation(samples: readonly number[], lag: number): number {
  const n = samples.length
  if (lag < 0 || lag >= n) return 0
  let mean = 0
  for (const sample of samples) mean += sample
  mean /= n
  let variance = 0
  let covariance = 0
  for (let index = 0; index < n; index += 1) {
    const centred = (samples[index] ?? 0) - mean
    variance += centred * centred
    if (index + lag < n) covariance += centred * ((samples[index + lag] ?? 0) - mean)
  }
  return variance > 0 ? covariance / variance : 1
}

export function effectiveSampleSize(samples: readonly number[], maxLag = 200): number {
  const n = samples.length
  if (n < 2) return n
  const limit = Math.min(maxLag, n - 1)
  let pairedSum = 0
  for (let lag = 0; lag + 1 <= limit; lag += 2) {
    const pair = autocorrelation(samples, lag) + autocorrelation(samples, lag + 1)
    if (pair <= 0) break
    pairedSum += pair
  }
  return clamp(n / Math.max(1, -1 + 2 * pairedSum), 1, n)
}

/* After a complete systematic sweep, either coordinate has AR(1)
 * coefficient rho^2. Its integrated autocorrelation time is therefore
 * (1+rho^2)/(1-rho^2). */
export function theoreticalEfficiency(rho: number): number {
  const squared = rho * rho
  return (1 - squared) / (1 + squared)
}
