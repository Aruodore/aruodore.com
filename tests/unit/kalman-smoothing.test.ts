import { describe, expect, it } from 'vitest'
import {
  createRecord,
  DEFAULT_SETTINGS,
  DT,
  GAP,
  normaliseSettings,
  positionInterval,
  smoothBackward,
  smoothingStats,
} from '../../pieces/kalman-smoothing/model'

describe('Kalman smoothing', () => {
  it('agrees with direct batch Gaussian conditioning on two future measurements', () => {
    const record = createRecord({ ...DEFAULT_SETTINGS, cutoff: 2, inspect: 0 })
    const a = DEFAULT_SETTINGS.measurementNoise ** 2
    const v = 4,
      q2 = DEFAULT_SETTINGS.processNoise ** 2
    const s11 = 2 * a + DT ** 2 * v + (q2 * DT ** 3) / 3
    const s22 = 2 * a + (2 * DT) ** 2 * v + (q2 * (2 * DT) ** 3) / 3
    const s12 = a + 2 * DT ** 2 * v + q2 * DT ** 3 * (1 / 3 + 1 / 2)
    const det = s11 * s22 - s12 ** 2
    const weight1 = (a * (s22 - s12)) / det
    const weight2 = (a * (s11 - s12)) / det
    const z0 = record.measurements[0]!.x
    const expectedMean = z0 + weight1 * (record.measurements[1]!.x - z0) + weight2 * (record.measurements[2]!.x - z0)
    expect(record.smoothed[0]!.mean[0]).toBeCloseTo(expectedMean, 11)
    expect(record.smoothed[0]!.covariance[0]).toBeCloseTo(a - a * (weight1 + weight2), 11)
  })

  it('preserves filtering prefixes and sensor draws when later evidence is added', () => {
    const early = createRecord({ ...DEFAULT_SETTINGS, cutoff: 60 })
    const late = createRecord()
    expect(early.measurements).toEqual(late.measurements)
    expect(early.filtered).toEqual(late.filtered.slice(0, 61))
    expect(early.smoothed[45]!.mean[0]).not.toBeCloseTo(late.smoothed[45]!.mean[0]!, 3)
    expect(late.smoothed[45]!.covariance[0]).toBeLessThan(early.smoothed[45]!.covariance[0]!)
    for (let k = GAP.first; k <= GAP.last; k += 1) expect(late.measurements[k]).toBeNull()
    const noGap = createRecord({ ...DEFAULT_SETTINGS, gap: false, processNoise: 2, measurementNoise: 1 })
    for (let k = 0; k < late.measurements.length; k += 1) {
      if (late.measurements[k]) expect(noGap.measurements[k]).toEqual(late.measurements[k])
    }
    expect(createRecord({ ...DEFAULT_SETTINGS, seed: 9 }).measurements).not.toEqual(late.measurements)
  })

  it.each([0.05, 0.5, 2])('keeps covariances positive and reduces them for q = %s', (processNoise) => {
    for (const measurementNoise of [0.05, 1]) {
      const record = createRecord({ ...DEFAULT_SETTINGS, processNoise, measurementNoise })
      expect(record.smoothed.at(-1)).toEqual(record.filtered.at(-1))
      for (let k = 0; k < record.smoothed.length; k += 1) {
        const P = record.filtered[k]!.covariance,
          S = record.smoothed[k]!.covariance
        for (const axis of [0, 1]) {
          const p = axis * 4 + axis,
            cross = axis * 4 + axis + 2,
            v = (axis + 2) * 4 + axis + 2
          expect(S[p]).toBeGreaterThan(0)
          expect(S[v]).toBeGreaterThan(0)
          expect(S[p]! * S[v]! - S[cross]! ** 2).toBeGreaterThan(-1e-10)
          expect(P[p]! - S[p]!).toBeGreaterThanOrEqual(-1e-10)
          expect(P[v]! - S[v]!).toBeGreaterThanOrEqual(-1e-10)
          expect((P[p]! - S[p]!) * (P[v]! - S[v]!) - (P[cross]! - S[cross]!) ** 2).toBeGreaterThan(-1e-10)
          expect(S[cross]).toBe(S[(axis + 2) * 4 + axis])
        }
        expect([...record.smoothed[k]!.mean].every(Number.isFinite)).toBe(true)
      }
    }
  })

  it('handles an empty backward pass and a single available state', () => {
    expect(smoothBackward([], [])).toEqual([])
    const record = createRecord({ ...DEFAULT_SETTINGS, cutoff: 0 })
    expect(record.settings.inspect).toBe(0)
    expect(record.smoothed).toEqual(record.filtered)
    expect(record.smoothed[0]).not.toBe(record.filtered[0])
    const stats = smoothingStats(record)
    expect(stats.filterRmse).toBe(stats.smootherRmse)
    expect(positionInterval(record.filtered[0]!)).toEqual([stats.filteredLow, stats.filteredHigh])
  })

  it('bounds controls and handles non-finite inputs', () => {
    expect(
      normaliseSettings({ ...DEFAULT_SETTINGS, cutoff: -8, inspect: 80, processNoise: 50, measurementNoise: -1 }),
    ).toMatchObject({ cutoff: 0, inspect: 0, processNoise: 2, measurementNoise: 0.05 })
    expect(
      normaliseSettings({
        ...DEFAULT_SETTINGS,
        cutoff: NaN,
        inspect: NaN,
        processNoise: NaN,
        measurementNoise: Infinity,
      }),
    ).toEqual(DEFAULT_SETTINGS)
    expect(normaliseSettings({ ...DEFAULT_SETTINGS, cutoff: 2, inspect: NaN }).inspect).toBe(2)
    const record = createRecord()
    const stats = smoothingStats(record)
    expect(stats.smootherRmse).toBeLessThan(stats.filterRmse)
    expect(stats.smoothedHigh - stats.smoothedLow).toBeLessThan(stats.filteredHigh - stats.filteredLow)
  })
})
