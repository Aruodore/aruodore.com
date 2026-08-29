import { describe, expect, it } from 'vitest'
import {
  bridgeCovariance,
  bridgeMean,
  bridgeStandardDeviation,
  clampBrownianBridgeParameters,
  conditionBrownianPath,
} from '../../pieces/brownian-bridge/model'

describe('brownian bridge model', () => {
  it('pins a conditioned path to both endpoints', () => {
    const bridge = conditionBrownianPath([0, 0.4, -0.2, 1.3], 0.75, 1.2)
    expect(bridge[0]).toBe(0)
    expect(bridge.at(-1)).toBeCloseTo(0.75)
  })

  it('has the linear conditional mean and zero terminal variance', () => {
    expect(bridgeMean(0.5, 2)).toBe(1)
    expect(bridgeCovariance(0.25, 0.75)).toBeCloseTo(0.0625)
    expect(bridgeStandardDeviation(0.5, 0.8)).toBeCloseTo(0.4)
    expect(bridgeStandardDeviation(1, 0.8)).toBe(0)
  })

  it('clamps interactive parameters to their declared range', () => {
    expect(clampBrownianBridgeParameters({ endpoint: 0, sigma: 1 }, { endpoint: 9, sigma: 0 })).toEqual({
      endpoint: 2,
      sigma: 0.35,
    })
  })
})
