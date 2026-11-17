import { createSeededRandom, standardNormal } from '../gaussian-process-regression/model'
export interface Settings {
  inspect: number
  particles: number
  processNoise: number
  sensorNoise: number
  threshold: number
  seed: number
}
export const LAST_STEP = 30
export const INITIAL_SD = 5
export const DEFAULT_SETTINGS: Settings = {
  inspect: 9,
  particles: 160,
  processNoise: 3,
  sensorNoise: 2,
  threshold: 0.5,
  seed: 20261029,
}
export interface Frame {
  positions: number[]
  weights: number[]
  priorWeights: number[]
  ancestors: number[]
  ess: number
  resampled: boolean
}
export interface Record {
  truth: number[]
  observations: (number | null)[]
  frames: Frame[]
  settings: Settings
}
/* Nonlinear growth drift: a linear term, a saturating rational term, and
 * a known periodic forcing. The sensor x²/20 cannot identify sign alone. */
export const transitionMean = (x: number, k: number) => 0.5 * x + (25 * x) / (1 + x * x) + 8 * Math.cos(1.2 * k)
export const sensor = (x: number) => (x * x) / 20
export function normaliseLogWeights(logs: number[]): number[] {
  const largest = Math.max(...logs)
  const values = logs.map((v) => Math.exp(v - largest))
  const total = values.reduce((sum, v) => sum + v, 0)
  return values.map((v) => v / total)
}
export const effectiveSampleSize = (weights: number[]) => 1 / weights.reduce((sum, w) => sum + w * w, 0)
export function systematicResample(weights: number[], offset: number): number[] {
  const n = weights.length,
    result: number[] = []
  let index = 0,
    cumulative = weights[0]!
  for (let j = 0; j < n; j++) {
    const u = (j + offset) / n
    while (u >= cumulative && index < n - 1) cumulative += weights[++index]!
    result.push(index)
  }
  return result
}
export function weightedQuantile(positions: number[], weights: number[], quantile: number): number {
  const sorted = positions.map((x, i) => ({ x, w: weights[i]! })).sort((a, b) => a.x - b.x)
  let cumulative = 0
  for (const p of sorted) {
    cumulative += p.w
    if (cumulative >= quantile) return p.x
  }
  return sorted.at(-1)!.x
}
export const weightedMean = (positions: number[], weights: number[]) =>
  positions.reduce((sum, x, i) => sum + x * weights[i]!, 0)
/* Bootstrap proposal: draw from f(x_k | x_{k-1}), then multiply inherited
 * weights by the likelihood. Resampling is deferred to the next prediction.
 * Independent streams keep the observed experiment fixed as N changes. */
export function createRecord(input: Settings = DEFAULT_SETTINGS, cutoff = LAST_STEP, gap = false): Record {
  const settings = { ...input, particles: Math.max(16, Math.min(512, Math.round(input.particles))) }
  const dataRandom = createSeededRandom(settings.seed)
  const filterRandom = createSeededRandom(settings.seed ^ 0x9e3779b9)
  const truth = [INITIAL_SD * standardNormal(dataRandom)]
  const observations: (number | null)[] = [sensor(truth[0]!) + settings.sensorNoise * standardNormal(dataRandom)]
  for (let k = 1; k <= LAST_STEP; k++) {
    truth.push(transitionMean(truth[k - 1]!, k) + settings.processNoise * standardNormal(dataRandom))
    observations.push(sensor(truth[k]!) + settings.sensorNoise * standardNormal(dataRandom))
  }
  if (gap) for (let k = 10; k <= 15; k++) observations[k] = null
  const frames: Frame[] = []
  const n = settings.particles
  for (let k = 0; k <= Math.min(LAST_STEP, Math.max(0, Math.round(cutoff))); k++) {
    const previous = frames[k - 1]
    const ancestors = previous?.resampled
      ? systematicResample(previous.weights, filterRandom())
      : Array.from({ length: n }, (_, i) => i)
    const positions = ancestors.map((i) =>
      previous
        ? transitionMean(previous.positions[i]!, k) + settings.processNoise * standardNormal(filterRandom)
        : INITIAL_SD * standardNormal(filterRandom),
    )
    const priorWeights = ancestors.map((i) => (!previous || previous.resampled ? 1 / n : previous.weights[i]!))
    const logs = positions.map(
      (x, i) =>
        Math.log(priorWeights[i]!) -
        (observations[k] === null ? 0 : 0.5 * ((observations[k]! - sensor(x)) / settings.sensorNoise) ** 2),
    )
    const weights = normaliseLogWeights(logs)
    const ess = effectiveSampleSize(weights)
    frames.push({ positions, weights, priorWeights, ancestors, ess, resampled: ess < settings.threshold * n })
  }
  return { truth, observations, frames, settings }
}
