/* Fixed-interval RTS smoothing of the constant-velocity tracker. The two
 * axes are independent, so the 4 x 4 recursion separates into two 2 x 2
 * position-velocity blocks. No hidden truth enters either inference pass. */
import {
  createSeededRandom,
  standardNormal,
  truePosition,
  initialState,
  predict,
  update,
  DT,
  TRUE_MEASUREMENT_SD,
  MEASUREMENT_ASPECT,
  type Gaussian,
  type Point,
} from '../kalman-filtering/model'

export { DT }
export const LAST_STEP = 100
export const GAP = { first: 30, last: 60 } as const
export const NORMAL_95 = 1.959963984540054
export const DEFAULT_SETTINGS = {
  cutoff: LAST_STEP,
  inspect: 45,
  processNoise: 0.5,
  measurementNoise: 0.15,
  gap: true,
  seed: 20261027,
} as const
export interface SmoothingSettings {
  cutoff: number
  inspect: number
  processNoise: number
  measurementNoise: number
  gap: boolean
  seed: number
}
export interface SmoothingRecord {
  truth: Point[]
  measurements: (Point | null)[]
  filtered: Gaussian[]
  predicted: Gaussian[]
  smoothed: Gaussian[]
  settings: SmoothingSettings
}
export interface SmoothingStats {
  filteredMean: number
  filteredLow: number
  filteredHigh: number
  smoothedMean: number
  smoothedLow: number
  smoothedHigh: number
  filterRmse: number
  smootherRmse: number
}

export function normaliseSettings(settings: SmoothingSettings): SmoothingSettings {
  const bound = (value: number, min: number, max: number, fallback: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
  const cutoff = Math.round(bound(settings.cutoff, 0, LAST_STEP, LAST_STEP))
  return {
    cutoff,
    inspect: Math.round(bound(settings.inspect, 0, cutoff, Math.min(DEFAULT_SETTINGS.inspect, cutoff))),
    processNoise: bound(settings.processNoise, 0.05, 2, DEFAULT_SETTINGS.processNoise),
    measurementNoise: bound(settings.measurementNoise, 0.05, 1, DEFAULT_SETTINGS.measurementNoise),
    gap: settings.gap,
    seed: settings.seed >>> 0,
  }
}

/* P_k F^T times the inverse of P^-_{k+1}, for one independent axis.
 * The predicted block is positive definite since q > 0. */
export function smoothBackward(filtered: Gaussian[], predicted: Gaussian[]): Gaussian[] {
  const smoothed = filtered.map((state) => ({ mean: state.mean.slice(), covariance: state.covariance.slice() }))
  for (let k = filtered.length - 2; k >= 0; k -= 1) {
    const current = filtered[k]!
    const nextPrediction = predicted[k + 1]!
    const next = smoothed[k + 1]!
    const result = smoothed[k]!
    for (const axis of [0, 1]) {
      const indices = [axis, axis + 2]
      const at = (matrix: Float64Array, i: number, j: number) => matrix[indices[i]! * 4 + indices[j]!]!
      const P = current.covariance
      const B = nextPrediction.covariance
      const a = at(B, 0, 0),
        b = at(B, 0, 1),
        d = at(B, 1, 1)
      const det = a * d - b * b
      const cross = [at(P, 0, 0) + DT * at(P, 0, 1), at(P, 0, 1), at(P, 1, 0) + DT * at(P, 1, 1), at(P, 1, 1)]
      const gain = [
        (cross[0]! * d - cross[1]! * b) / det,
        (cross[1]! * a - cross[0]! * b) / det,
        (cross[2]! * d - cross[3]! * b) / det,
        (cross[3]! * a - cross[2]! * b) / det,
      ]
      // m^s_k = m_k + G_k (m^s_{k+1} - m^-_{k+1}).
      for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
          result.mean[indices[i]!] =
            result.mean[indices[i]!]! + gain[i * 2 + j]! * (next.mean[indices[j]!]! - nextPrediction.mean[indices[j]!]!)
        }
      }
      // P^s_k = P_k + G_k (P^s_{k+1} - P^-_{k+1}) G_k^T.
      for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
          let correction = 0
          for (let u = 0; u < 2; u += 1)
            for (let v = 0; v < 2; v += 1)
              correction += gain[i * 2 + u]! * (at(next.covariance, u, v) - at(B, u, v)) * gain[j * 2 + v]!
          result.covariance[indices[i]! * 4 + indices[j]!] = at(P, i, j) + correction
        }
      }
      const offDiagonal = (result.covariance[axis * 4 + axis + 2]! + result.covariance[(axis + 2) * 4 + axis]!) / 2
      result.covariance[axis * 4 + axis + 2] = offDiagonal
      result.covariance[(axis + 2) * 4 + axis] = offDiagonal
    }
  }
  return smoothed
}

export function createRecord(input: SmoothingSettings = DEFAULT_SETTINGS): SmoothingRecord {
  const settings = normaliseSettings(input)
  const random = createSeededRandom(settings.seed)
  const truth: Point[] = []
  const measurements: (Point | null)[] = []
  const filtered: Gaussian[] = []
  const predicted: Gaussian[] = []
  // Consume both sensor draws for every time, even inside a missing-data gap.
  for (let k = 0; k <= LAST_STEP; k += 1) {
    const point = truePosition(k * DT)
    truth.push(point)
    const z = {
      x: point.x + TRUE_MEASUREMENT_SD * standardNormal(random),
      y: point.y + MEASUREMENT_ASPECT * TRUE_MEASUREMENT_SD * standardNormal(random),
    }
    measurements.push(settings.gap && k >= GAP.first && k <= GAP.last ? null : z)
  }
  for (let k = 0; k <= settings.cutoff; k += 1) {
    const z = measurements[k]
    const prior =
      k === 0
        ? initialState(measurements[0]!, settings.measurementNoise)
        : predict(filtered[k - 1]!, settings.processNoise)
    predicted.push(prior)
    filtered.push(k > 0 && z ? update(prior, z, settings.measurementNoise).state : prior)
  }
  return { truth, measurements, filtered, predicted, smoothed: smoothBackward(filtered, predicted), settings }
}

export function positionInterval(state: Gaussian): [number, number] {
  const radius = NORMAL_95 * Math.sqrt(Math.max(0, state.covariance[0]!))
  return [state.mean[0]! - radius, state.mean[0]! + radius]
}

export function smoothingStats(record: SmoothingRecord): SmoothingStats {
  const k = record.settings.inspect
  const filtered = record.filtered[k]!,
    smoothed = record.smoothed[k]!
  const [filteredLow, filteredHigh] = positionInterval(filtered)
  const [smoothedLow, smoothedHigh] = positionInterval(smoothed)
  const rmse = (states: Gaussian[]) =>
    Math.sqrt(states.reduce((sum, state, i) => sum + (state.mean[0]! - record.truth[i]!.x) ** 2, 0) / states.length)
  return {
    filteredMean: filtered.mean[0]!,
    filteredLow,
    filteredHigh,
    smoothedMean: smoothed.mean[0]!,
    smoothedLow,
    smoothedHigh,
    filterRmse: rmse(record.filtered),
    smootherRmse: rmse(record.smoothed),
  }
}
