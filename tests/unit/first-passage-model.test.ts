import { describe, expect, it } from 'vitest'
import {
  clampFirstPassageParameters,
  firstPassageCdf,
  firstPassageDensity,
  standardNormalCdf,
} from '../../pieces/first-passage/model'

describe('first-passage model', () => {
  it('approximates the standard normal distribution', () => {
    expect(standardNormalCdf(0)).toBeCloseTo(0.5, 6)
    expect(standardNormalCdf(1.96)).toBeCloseTo(0.975, 3)
    expect(standardNormalCdf(-1.96)).toBeCloseTo(0.025, 3)
  })

  it('computes the Brownian first-passage distribution', () => {
    expect(firstPassageCdf(1, 1, 1)).toBeCloseTo(0.31731, 4)
    expect(firstPassageDensity(1, 1, 1)).toBeCloseTo(0.24197, 4)
    expect(firstPassageCdf(0, 1, 1)).toBe(0)
    expect(firstPassageDensity(-1, 1, 1)).toBe(0)
  })

  it('has the expected Brownian scaling', () => {
    expect(firstPassageCdf(4, 2, 1)).toBeCloseTo(firstPassageCdf(1, 1, 1), 6)
    expect(firstPassageCdf(1, 2, 2)).toBeCloseTo(firstPassageCdf(1, 1, 1), 6)
  })

  it('clamps interactive parameters to supported ranges', () => {
    expect(clampFirstPassageParameters({ boundary: 1, sigma: 1 }, { boundary: 9, sigma: 0 })).toEqual({
      boundary: 2.5,
      sigma: 0.4,
    })
  })
})
