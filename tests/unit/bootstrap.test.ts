import { describe, expect, it } from 'vitest'
import {
  bootstrapMean,
  bootstrapMeanStandardError,
  clampBootstrapParameters,
  createSeededRandom,
  drawBootstrapSample,
  generateObservedSample,
  mean,
  percentileInterval,
  quantile,
  sampleStandardDeviation,
} from '../../pieces/bootstrap/model'

describe('bootstrap model', () => {
  it('computes the sample summaries used by the figure', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5)
    expect(sampleStandardDeviation([1, 2, 3, 4])).toBeCloseTo(Math.sqrt(5 / 3))
    expect(bootstrapMeanStandardError([1, 2, 3, 4])).toBeCloseTo(Math.sqrt(5) / 4)
  })

  it('defines empty and undersized summary behavior', () => {
    expect(mean([])).toBeNaN()
    expect(sampleStandardDeviation([1])).toBeNaN()
    expect(bootstrapMeanStandardError([1])).toBeNaN()
    expect(quantile([], 0.5)).toBeNaN()
  })

  it('draws n observations with replacement', () => {
    const draws = [0, 0.34, 0.99]
    let index = 0
    const resample = drawBootstrapSample([10, 20, 30], () => draws[index++] ?? 0)

    expect(resample).toEqual([10, 20, 30])
    expect(bootstrapMean([10, 20, 30], () => 0)).toBe(10)
    expect(drawBootstrapSample([], () => 0)).toEqual([])
  })

  it('interpolates quantiles and forms a central percentile interval', () => {
    expect(quantile([4, 1, 3, 2], 0.5)).toBe(2.5)
    expect(quantile([1, 3], -1)).toBe(1)
    expect(quantile([1, 3], 2)).toBe(3)
    expect(percentileInterval([1, 2, 3, 4, 5], 0.8)).toEqual({ lower: 1.4, upper: 4.6 })
  })

  it('makes generated samples reproducible and positive', () => {
    const first = generateObservedSample(12, createSeededRandom(19))
    const second = generateObservedSample(12, createSeededRandom(19))

    expect(first).toEqual(second)
    expect(first.every((value) => value > 0)).toBe(true)
  })

  it('clamps controls to the supported integer ranges', () => {
    expect(clampBootstrapParameters({ sampleSize: 24, speed: 12 }, { sampleSize: 3, speed: 80 })).toEqual({
      sampleSize: 8,
      speed: 60,
    })
    expect(clampBootstrapParameters({ sampleSize: 24, speed: 12 }, {})).toEqual({ sampleSize: 24, speed: 12 })
    expect(clampBootstrapParameters({ sampleSize: 24, speed: 12 }, { sampleSize: 25.6, speed: 4.6 })).toEqual({
      sampleSize: 26,
      speed: 5,
    })
  })
})
