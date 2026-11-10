import { cholesky, forwardSubstitute, backSubstitute, squaredExponential } from '../gaussian-process-regression/model'

export interface Observation {
  x: number
  y: number
}
export interface Settings {
  iterations: number
  lengthScale: number
  exploration: number
}
export const DEFAULT_SETTINGS: Settings = { iterations: 5, lengthScale: 0.8, exploration: 0.05 }
export const GRID = Array.from({ length: 121 }, (_, i) => i / 12)
export const INITIAL_INPUTS = [0.5, 4.5, 8.5]
export const NUGGET = 1e-6
export const objective = (x: number) => Math.sin(1.1 * x) + 0.45 * Math.cos(2.6 * x + 0.4)
export const normalPdf = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI)
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const tail =
    normalPdf(x) * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return x >= 0 ? 1 - tail : tail
}
/* E[max(0, f - best - margin)] for f ~ N(mean, sd²). The zero-variance
 * limit is deterministic improvement rather than a division by zero. */
export function expectedImprovement(mean: number, sd: number, best: number, exploration = 0): number {
  const delta = mean - best - exploration
  if (sd < 1e-12) return Math.max(0, delta)
  const z = delta / sd
  return Math.max(0, delta * normalCdf(z) + sd * normalPdf(z))
}
/* Cholesky solves give kᵀ A⁻¹ y and the residual variance 1 - |L⁻¹k|².
 * Only marginal predictions are needed, so no grid covariance is built. */
export function predict(observations: Observation[], lengthScale: number, grid = GRID) {
  const n = observations.length
  const A = Float64Array.from(
    { length: n * n },
    (_, k) =>
      squaredExponential(observations[Math.floor(k / n)]!.x, observations[k % n]!.x, lengthScale) +
      (Math.floor(k / n) === k % n ? NUGGET : 0),
  )
  const L = cholesky(A, n)
  const alpha = backSubstitute(
    L,
    forwardSubstitute(
      L,
      Float64Array.from(observations, (o) => o.y),
      n,
    ),
    n,
  )
  return grid.map((x) => {
    const cross = Float64Array.from(observations, (o) => squaredExponential(o.x, x, lengthScale))
    const v = forwardSubstitute(L, cross, n)
    const mean = cross.reduce((sum, k, i) => sum + k * alpha[i]!, 0)
    const sd = Math.sqrt(Math.max(0, 1 - v.reduce((sum, a) => sum + a * a, 0)))
    return { x, mean, sd }
  })
}
export function suggest(observations: Observation[], lengthScale: number, exploration: number) {
  const best = Math.max(...observations.map((o) => o.y))
  const posterior = predict(observations, lengthScale)
  const acquisition = posterior.map((p) =>
    observations.some((o) => Math.abs(o.x - p.x) < 1e-8) ? 0 : expectedImprovement(p.mean, p.sd, best, exploration),
  )
  let next = -1
  for (let i = 0; i < GRID.length; i++) {
    if (observations.some((o) => Math.abs(o.x - GRID[i]!) < 1e-8)) continue
    if (next < 0 || acquisition[i]! > acquisition[next]!) next = i
  }
  return { posterior, acquisition, nextX: GRID[next]!, best }
}
/* Replay a policy from fixed initial evaluations. The objective is called
 * only after an acquisition decision, never while evaluating its score. */
export function createRecord(settings: Settings = DEFAULT_SETTINGS) {
  const observations = INITIAL_INPUTS.map((x) => ({ x, y: objective(x) }))
  const history = [Math.max(...observations.map((o) => o.y))]
  const count = Math.max(3, Math.min(18, Math.round(settings.iterations)))
  while (observations.length < count) {
    const { nextX } = suggest(observations, settings.lengthScale, settings.exploration)
    observations.push({ x: nextX, y: objective(nextX) })
    history.push(Math.max(...observations.map((o) => o.y)))
  }
  return { observations, history, ...suggest(observations, settings.lengthScale, settings.exploration) }
}
