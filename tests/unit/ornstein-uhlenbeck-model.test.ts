import { describe, expect, it } from 'vitest'
import {
  clampOrnsteinUhlenbeckParameters,
  ornsteinUhlenbeckMemory,
  ornsteinUhlenbeckStationaryVariance,
  ornsteinUhlenbeckTransition,
} from '../../pieces/ornstein-uhlenbeck/model'

describe('Ornstein–Uhlenbeck model', () => {
  const parameters = { theta: 0.5, mu: 2, sigma: 1 }

  it('calculates stationary variance and memory', () => {
    expect(ornsteinUhlenbeckStationaryVariance(0.5, 2)).toBe(4)
    expect(ornsteinUhlenbeckMemory(0.5)).toBe(2)
  })

  it('uses the exact deterministic transition when the normal is zero', () => {
    const expected = 2 + (4 - 2) * Math.exp(-0.5)
    expect(ornsteinUhlenbeckTransition(4, parameters, 1, 0)).toBeCloseTo(expected)
  })

  it('clamps unstable parameter values and preserves omitted values', () => {
    expect(clampOrnsteinUhlenbeckParameters(parameters, { theta: 0, sigma: -1 })).toEqual({
      theta: 0.05,
      mu: 2,
      sigma: 0.05,
    })
    expect(clampOrnsteinUhlenbeckParameters(parameters, { mu: 0 })).toEqual({ theta: 0.5, mu: 0, sigma: 1 })
  })
})
