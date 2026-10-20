/*
 * Gaussian process regression in one dimension.
 *
 * The prior places a zero-mean Gaussian process on the unknown function,
 *
 *     f ~ GP(0, k),   k(x, x') = sigma_f^2 exp(-(x - x')^2 / (2 l^2)),
 *
 * so any finite collection of function values is jointly Gaussian. The
 * observations are y_i = f(x_i) + eps_i with eps_i ~ N(0, sigma_n^2).
 * Conditioning the joint Gaussian of (y, f(x_*)) on y gives the posterior
 * over function values on a grid of test inputs x_*:
 *
 *     mean       m_* = K_*^T (K + sigma_n^2 I)^{-1} y
 *     covariance S_* = K_** - K_*^T (K + sigma_n^2 I)^{-1} K_*
 *
 * where K = k(X, X), K_* = k(X, x_*), K_** = k(x_*, x_*). Every inverse is
 * applied through a Cholesky factor rather than formed explicitly.
 */

export const GP_DOMAIN = { min: 0, max: 10 } as const
export const GP_RANGE = { min: -3, max: 3 } as const

export const GP_LIMITS = {
  lengthScale: { min: 0.3, max: 3 },
  noise: { min: 0.02, max: 1 },
} as const

/* Prior signal standard deviation sigma_f. Held at 1 so the prior 95%
 * band is the fixed interval [-1.96, 1.96] and the visitor's attention
 * stays on the length scale and the noise. */
export const SIGNAL_SD = 1

/* Grid resolution for the posterior over functions. 120 points keep the
 * dense M x M covariance and its Cholesky factor cheap enough to rebuild
 * on every click while still drawing smooth curves. */
export const GRID_SIZE = 120

export const MAX_OBSERVATIONS = 30

/* Seeds for the opening data, the "Add observation" stream, and the
 * latent vectors behind the sample curves. Shared by the live canvas and
 * the static preview generator so the still is the figure's first frame. */
export const FIGURE_SEEDS = { initial: 20261020, observations: 7187, latents: 5303 } as const
export const SAMPLE_PATHS = 3

/* Diagonal jitter added before factorising the posterior covariance.
 * Near the data S_* is numerically rank deficient; a jitter far below
 * the plotted resolution keeps the factorisation stable. */
const COVARIANCE_JITTER = 1e-8

/* The standard normal quantile for a central 95% interval. */
export const Z_95 = 1.959963984540054

/* The hidden function that generates "Add observation" data, and the
 * noise of that generating process. The model never sees either: it only
 * receives the resulting (x, y) pairs, so a visitor can set the model
 * noise sigma_n away from TRUE_NOISE_SD and watch the fit degrade. */
export const TRUE_NOISE_SD = 0.18

export function latentFunction(x: number): number {
  return Math.sin(1.1 * x) + 0.45 * Math.cos(2.6 * x + 0.4)
}

export interface Observation {
  x: number
  y: number
}

export interface GpParameters {
  lengthScale: number
  noise: number
}

export interface Posterior {
  grid: Float64Array
  mean: Float64Array
  sd: Float64Array
  /* Lower-triangular factor L with L L^T = S_* (row-major, M x M). */
  covarianceFactor: Float64Array
  logMarginalLikelihood: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function clampGpParameters(current: GpParameters, next: Partial<GpParameters>): GpParameters {
  return {
    lengthScale:
      next.lengthScale === undefined
        ? current.lengthScale
        : clamp(next.lengthScale, GP_LIMITS.lengthScale.min, GP_LIMITS.lengthScale.max),
    noise: next.noise === undefined ? current.noise : clamp(next.noise, GP_LIMITS.noise.min, GP_LIMITS.noise.max),
  }
}

/* Squared-exponential kernel. Its value decays with squared distance, so
 * l is the distance over which function values stay strongly correlated. */
export function squaredExponential(a: number, b: number, lengthScale: number, signalSd = SIGNAL_SD): number {
  const r = (a - b) / lengthScale
  return signalSd * signalSd * Math.exp(-0.5 * r * r)
}

export function linspace(min: number, max: number, count: number): Float64Array {
  const grid = new Float64Array(count)
  const step = count > 1 ? (max - min) / (count - 1) : 0
  for (let i = 0; i < count; i += 1) grid[i] = min + i * step
  return grid
}

/* In-place Cholesky factorisation A = L L^T of a symmetric positive
 * semidefinite matrix stored row-major. A non-positive pivot (a direction
 * with no remaining variance) zeroes its column instead of failing, which
 * is the correct factor for a semidefinite posterior covariance. */
export function cholesky(matrix: Float64Array, size: number): Float64Array {
  const L = new Float64Array(size * size)
  for (let j = 0; j < size; j += 1) {
    let diagonal = matrix[j * size + j]!
    for (let k = 0; k < j; k += 1) diagonal -= L[j * size + k]! ** 2
    const pivot = diagonal > 0 ? Math.sqrt(diagonal) : 0
    L[j * size + j] = pivot
    for (let i = j + 1; i < size; i += 1) {
      let value = matrix[i * size + j]!
      for (let k = 0; k < j; k += 1) value -= L[i * size + k]! * L[j * size + k]!
      L[i * size + j] = pivot > 0 ? value / pivot : 0
    }
  }
  return L
}

/* Solve L z = b by forward substitution. */
export function forwardSubstitute(L: Float64Array, b: Float64Array, size: number): Float64Array {
  const z = new Float64Array(size)
  for (let i = 0; i < size; i += 1) {
    let value = b[i]!
    for (let k = 0; k < i; k += 1) value -= L[i * size + k]! * z[k]!
    z[i] = value / L[i * size + i]!
  }
  return z
}

/* Solve L^T z = b by back substitution. */
export function backSubstitute(L: Float64Array, b: Float64Array, size: number): Float64Array {
  const z = new Float64Array(size)
  for (let i = size - 1; i >= 0; i -= 1) {
    let value = b[i]!
    for (let k = i + 1; k < size; k += 1) value -= L[k * size + i]! * z[k]!
    z[i] = value / L[i * size + i]!
  }
  return z
}

export function gpPosterior(
  observations: readonly Observation[],
  parameters: GpParameters,
  grid: Float64Array = linspace(GP_DOMAIN.min, GP_DOMAIN.max, GRID_SIZE),
): Posterior {
  const { lengthScale, noise } = parameters
  const n = observations.length
  const M = grid.length

  /* Prior covariance on the grid, K_**. */
  const covariance = new Float64Array(M * M)
  for (let i = 0; i < M; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      const value = squaredExponential(grid[i]!, grid[j]!, lengthScale)
      covariance[i * M + j] = value
      covariance[j * M + i] = value
    }
  }
  const mean = new Float64Array(M)
  let logMarginalLikelihood = 0

  if (n > 0) {
    /* A = K + sigma_n^2 I and its factor L_A. */
    const A = new Float64Array(n * n)
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        A[i * n + j] = squaredExponential(observations[i]!.x, observations[j]!.x, lengthScale)
      }
      A[i * n + i] = A[i * n + i]! + noise * noise
    }
    const LA = cholesky(A, n)
    const y = Float64Array.from(observations, (observation) => observation.y)

    /* alpha = A^{-1} y = L_A^{-T} L_A^{-1} y gives the posterior mean as a
     * kernel-weighted sum: m(x_*) = sum_i alpha_i k(x_i, x_*). */
    const w = forwardSubstitute(LA, y, n)
    const alpha = backSubstitute(LA, w, n)

    /* V = L_A^{-1} K_*, one column per grid point, so that
     * K_*^T A^{-1} K_* = V^T V is the variance explained by the data. */
    const V = new Float64Array(n * M)
    const column = new Float64Array(n)
    for (let j = 0; j < M; j += 1) {
      let m = 0
      for (let i = 0; i < n; i += 1) {
        const k = squaredExponential(observations[i]!.x, grid[j]!, lengthScale)
        column[i] = k
        m += k * alpha[i]!
      }
      mean[j] = m
      const v = forwardSubstitute(LA, column, n)
      for (let i = 0; i < n; i += 1) V[i * M + j] = v[i]!
    }
    for (let a = 0; a < M; a += 1) {
      for (let b = 0; b <= a; b += 1) {
        let explained = 0
        for (let i = 0; i < n; i += 1) explained += V[i * M + a]! * V[i * M + b]!
        const value = covariance[a * M + b]! - explained
        covariance[a * M + b] = value
        covariance[b * M + a] = value
      }
    }

    /* log p(y | X) = -1/2 y^T A^{-1} y - 1/2 log|A| - n/2 log(2 pi), with
     * y^T A^{-1} y = |L_A^{-1} y|^2 and log|A| = 2 sum_i log (L_A)_ii. */
    let fit = 0
    let logDeterminant = 0
    for (let i = 0; i < n; i += 1) {
      fit += w[i]! ** 2
      logDeterminant += 2 * Math.log(LA[i * n + i]!)
    }
    logMarginalLikelihood = -0.5 * fit - 0.5 * logDeterminant - 0.5 * n * Math.log(2 * Math.PI)
  }

  const sd = new Float64Array(M)
  for (let i = 0; i < M; i += 1) {
    sd[i] = Math.sqrt(Math.max(0, covariance[i * M + i]!))
    covariance[i * M + i] = covariance[i * M + i]! + COVARIANCE_JITTER
  }

  return { grid, mean, sd, covarianceFactor: cholesky(covariance, M), logMarginalLikelihood }
}

/* A point on a great circle through two independent standard normal
 * vectors z_1, z_2: f(theta) = m + L (z_1 cos theta + z_2 sin theta).
 * Because cos^2 + sin^2 = 1, the combination is again N(0, I) for every
 * theta, so each frame of the animation is an exact posterior draw, and
 * consecutive frames differ smoothly instead of jumping. */
export function samplePath(
  posterior: Posterior,
  z1: Float64Array,
  z2: Float64Array,
  theta: number,
  out: Float64Array = new Float64Array(posterior.mean.length),
): Float64Array {
  const M = posterior.mean.length
  const L = posterior.covarianceFactor
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  for (let i = 0; i < M; i += 1) {
    let value = posterior.mean[i]!
    for (let k = 0; k <= i; k += 1) value += L[i * M + k]! * (c * z1[k]! + s * z2[k]!)
    out[i] = value
  }
  return out
}

export function averageSd(posterior: Posterior): number {
  let total = 0
  for (const value of posterior.sd) total += value
  return total / posterior.sd.length
}

export function createSeededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function standardNormal(random: () => number): number {
  const u = Math.max(Number.EPSILON, random())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

export function standardNormalVector(size: number, random: () => number): Float64Array {
  return Float64Array.from({ length: size }, () => standardNormal(random))
}

/* One noisy observation of the hidden function at a uniform input. */
export function drawObservation(random: () => number): Observation {
  const x = GP_DOMAIN.min + random() * (GP_DOMAIN.max - GP_DOMAIN.min)
  return { x, y: latentFunction(x) + TRUE_NOISE_SD * standardNormal(random) }
}

/* Opening inputs are fixed rather than uniform so the first view always
 * shows both regimes: narrow bands near data and a wide gap between 4.6
 * and 7.6 where the posterior relaxes back toward the prior. */
export const INITIAL_INPUTS = [0.9, 2.3, 3.6, 4.6, 7.6, 8.9] as const

export function initialObservations(seed: number): Observation[] {
  const random = createSeededRandom(seed)
  return INITIAL_INPUTS.map((x) => ({ x, y: latentFunction(x) + TRUE_NOISE_SD * standardNormal(random) }))
}
