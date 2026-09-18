import { describe, expect, it } from 'vitest'
import {
  acceptanceProbability,
  clampHmcParameters,
  hamiltonian,
  leapfrog,
  type HmcState,
} from '../../pieces/hamiltonian-monte-carlo/model'

describe('Hamiltonian Monte Carlo model', () => {
  it('keeps energy nearly constant at the interactive default', () => {
    const start: HmcState = { position: { x: -2.6, y: -2.2 }, momentum: { x: 0.55, y: -0.35 } }
    const proposal = leapfrog(start, 0.16, 16)

    expect(Math.abs(hamiltonian(proposal) - hamiltonian(start))).toBeLessThan(0.1)
    expect(acceptanceProbability(start, proposal)).toBeGreaterThan(0.9)
  })

  it('clamps controls to stable, readable values', () => {
    expect(clampHmcParameters({ stepSize: 0.16, leapfrogSteps: 16 }, { stepSize: 3, leapfrogSteps: 100 })).toEqual({
      stepSize: 0.5,
      leapfrogSteps: 32,
    })
  })
})
