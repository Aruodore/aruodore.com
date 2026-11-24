export interface Settings {
  iteration: number
  correlation: number
  rate: number
}
export interface Approximation {
  mean: [number, number]
  variance: [number, number]
}
export const TARGET_MEAN: [number, number] = [0.8, -0.5]
export const DEFAULT_SETTINGS: Settings = { iteration: 0, correlation: 0.85, rate: 0.5 }
/* Closed-form KL(q || p) with diagonal covariance for q and unit
 * marginal variances plus correlation rho for the Gaussian target p. */
export function divergence(q: Approximation, correlation: number): number {
  const d = 1 - correlation * correlation
  const a = q.mean[0] - TARGET_MEAN[0],
    b = q.mean[1] - TARGET_MEAN[1]
  const [v1, v2] = q.variance
  return 0.5 * ((v1 + v2 + a * a - 2 * correlation * a * b + b * b) / d - 2 + Math.log(d / (v1 * v2)))
}
/* Coordinate optima follow E_{q_other}[log p]. Each variance equals
 * the target conditional variance, 1-rho², rather than its marginal 1.
 * Damping in log variance keeps the approximation positive. */
export function coordinateStep(q: Approximation, correlation: number, rate: number): Approximation {
  const x = q.mean[0] + rate * (TARGET_MEAN[0] + correlation * (q.mean[1] - TARGET_MEAN[1]) - q.mean[0])
  const y = q.mean[1] + rate * (TARGET_MEAN[1] + correlation * (x - TARGET_MEAN[0]) - q.mean[1])
  const variance = 1 - correlation * correlation
  return {
    mean: [x, y],
    variance: q.variance.map((v) => Math.exp((1 - rate) * Math.log(v) + rate * Math.log(variance))) as [number, number],
  }
}
export function createRecord(settings: Settings = DEFAULT_SETTINGS) {
  const history: Approximation[] = [{ mean: [-2, 1.8], variance: [1.4 ** 2, 1] }]
  for (let i = 0; i < 40; i++) history.push(coordinateStep(history.at(-1)!, settings.correlation, settings.rate))
  const index = Math.max(0, Math.min(40, Math.round(settings.iteration)))
  return {
    history,
    current: history[index]!,
    kl: history.map((q) => divergence(q, settings.correlation)),
    optimumKl: -0.5 * Math.log(1 - settings.correlation ** 2),
    optimumSd: Math.sqrt(1 - settings.correlation ** 2),
  }
}
