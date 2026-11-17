import { describe, it, expect } from 'vitest'
import {
  createRecord,
  DEFAULT_SETTINGS,
  effectiveSampleSize,
  normaliseLogWeights,
  systematicResample,
} from '../../pieces/particle-filtering/model'
describe('bootstrap particle filter', () => {
  it('normalises tiny log probabilities without underflow and diagnoses unequal weights', () => {
    const weights = normaliseLogWeights([-10000, -10001, -Infinity])
    expect(weights[0]! / weights[1]!).toBeCloseTo(Math.E, 12)
    expect(weights[2]).toBe(0)
    expect(effectiveSampleSize([0.25, 0.25, 0.25, 0.25])).toBe(4)
    expect(effectiveSampleSize([1, 0, 0, 0])).toBe(1)
  })
  it('resamples systematically without selecting zero-weight parents, and is unbiased over offsets', () => {
    expect(systematicResample([0, 0.25, 0.75], 0)).toEqual([1, 2, 2])
    const counts = [0, 0, 0]
    for (let i = 0; i < 1000; i++)
      for (const parent of systematicResample([0, 0.25, 0.75], (i + 0.5) / 1000)) counts[parent]! += 1
    expect(counts[0]).toBe(0)
    expect(counts[1]! / 1000).toBeCloseTo(0.75, 2)
    expect(counts[2]! / 1000).toBeCloseTo(2.25, 2)
  })
  it('preserves observations across particle controls and never changes a filtered prefix with later evidence', () => {
    const full = createRecord()
    const early = createRecord(DEFAULT_SETTINGS, 10)
    expect(full.frames.slice(0, 11)).toEqual(early.frames)
    expect(createRecord({ ...DEFAULT_SETTINGS, particles: 32, threshold: 0 }).observations).toEqual(full.observations)
    expect(createRecord({ ...DEFAULT_SETTINGS, seed: 99 }).observations).not.toEqual(full.observations)
    const gap = createRecord(DEFAULT_SETTINGS, 30, true)
    for (let k = 10; k <= 15; k++) {
      expect(gap.observations[k]).toBeNull()
      gap.frames[k]!.weights.forEach((w, i) => expect(w).toBeCloseTo(gap.frames[k]!.priorWeights[i]!, 10))
    }
    expect(gap.observations[16]).toBe(full.observations[16])
  })
  it.each([0, 0.5, 1])('maintains a finite normalised population at resampling threshold %s', (threshold) => {
    for (const frame of createRecord({
      ...DEFAULT_SETTINGS,
      particles: 32,
      sensorNoise: 0.5,
      processNoise: 6,
      threshold,
    }).frames) {
      expect(frame.positions.every(Number.isFinite)).toBe(true)
      expect(frame.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
      expect(frame.ess).toBeGreaterThanOrEqual(1 - 1e-10)
      expect(frame.ess).toBeLessThanOrEqual(32 + 1e-10)
      expect(frame.ancestors.every((i) => i >= 0 && i < 32)).toBe(true)
    }
  })
})
