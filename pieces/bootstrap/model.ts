/*
 * Nonparametric bootstrap for a sample mean.
 *
 * The observed sample x_1, ..., x_n defines the empirical distribution
 *
 *     F_n = (1/n) sum_i delta_(x_i).
 *
 * A bootstrap sample draws n independent values from F_n, which is the
 * same as sampling the observed values with replacement. Repeating that
 * operation approximates the sampling distribution of the statistic
 * without specifying a parametric population model.
 */

export const BOOTSTRAP_LIMITS = {
  sampleSize: { min: 8, max: 64 },
  speed: { min: 1, max: 60 },
} as const

export interface BootstrapParameters {
  sampleSize: number
  speed: number
}

export interface Interval {
  lower: number
  upper: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function clampBootstrapParameters(
  current: BootstrapParameters,
  next: Partial<BootstrapParameters>,
): BootstrapParameters {
  return {
    sampleSize:
      next.sampleSize === undefined
        ? current.sampleSize
        : Math.round(clamp(next.sampleSize, BOOTSTRAP_LIMITS.sampleSize.min, BOOTSTRAP_LIMITS.sampleSize.max)),
    speed:
      next.speed === undefined
        ? current.speed
        : Math.round(clamp(next.speed, BOOTSTRAP_LIMITS.speed.min, BOOTSTRAP_LIMITS.speed.max)),
  }
}

export function mean(values: ArrayLike<number>): number {
  if (values.length === 0) return Number.NaN
  let total = 0
  for (let index = 0; index < values.length; index += 1) total += values[index] ?? 0
  return total / values.length
}

export function sampleStandardDeviation(values: ArrayLike<number>): number {
  if (values.length < 2) return Number.NaN
  const center = mean(values)
  let squared = 0
  for (let index = 0; index < values.length; index += 1) squared += ((values[index] ?? center) - center) ** 2
  return Math.sqrt(squared / (values.length - 1))
}

export function quantile(values: readonly number[], probability: number): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const position = clamp(probability, 0, 1) * (sorted.length - 1)
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const lower = sorted[lowerIndex] ?? sorted[0]!
  const upper = sorted[upperIndex] ?? sorted.at(-1)!
  return lower + (upper - lower) * (position - lowerIndex)
}

export function percentileInterval(replicates: readonly number[], mass = 0.95): Interval {
  const tail = (1 - clamp(mass, 0, 1)) / 2
  return { lower: quantile(replicates, tail), upper: quantile(replicates, 1 - tail) }
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

function standardNormal(random: () => number): number {
  const u = Math.max(Number.EPSILON, random())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

/* A shifted lognormal population gives the example visible skew without
 * extreme values dominating the plot. The bootstrap itself never sees
 * these generating parameters; it receives only the resulting sample. */
export function generateObservedSample(size: number, random: () => number): number[] {
  return Array.from({ length: size }, () => 0.75 + Math.exp(0.38 * standardNormal(random)))
}

export function drawBootstrapSample(sample: readonly number[], random: () => number): number[] {
  if (sample.length === 0) return []
  return Array.from({ length: sample.length }, () => sample[Math.floor(random() * sample.length)] ?? sample[0]!)
}

export function bootstrapMean(sample: readonly number[], random: () => number): number {
  return mean(drawBootstrapSample(sample, random))
}

/* The plug-in standard error of the bootstrap mean has the closed form
 * s sqrt((n-1)/n^2). It is useful as a deterministic check on the Monte
 * Carlo distribution accumulating in the figure. */
export function bootstrapMeanStandardError(sample: readonly number[]): number {
  if (sample.length < 2) return Number.NaN
  return (sampleStandardDeviation(sample) * Math.sqrt(sample.length - 1)) / sample.length
}
