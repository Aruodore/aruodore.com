/* Hamiltonian Monte Carlo on a correlated Gaussian target. The position q
 * follows the target and an auxiliary momentum p~N(0,I) supplies inertia.
 * Leapfrog alternates p <- p - eps/2 grad U(q), q <- q + eps p, then the
 * second half momentum update. Its reversibility and volume preservation
 * allow a Metropolis correction for the small numerical energy error. */

export const HMC_LIMITS = {
  stepSize: { min: 0.03, max: 0.5 },
  leapfrogSteps: { min: 2, max: 32 },
} as const

export interface HmcParameters {
  stepSize: number
  leapfrogSteps: number
}
export interface Point {
  x: number
  y: number
}
export interface HmcState {
  position: Point
  momentum: Point
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function clampHmcParameters(current: HmcParameters, next: Partial<HmcParameters>): HmcParameters {
  return {
    stepSize:
      next.stepSize === undefined
        ? current.stepSize
        : clamp(next.stepSize, HMC_LIMITS.stepSize.min, HMC_LIMITS.stepSize.max),
    leapfrogSteps:
      next.leapfrogSteps === undefined
        ? current.leapfrogSteps
        : Math.round(clamp(next.leapfrogSteps, HMC_LIMITS.leapfrogSteps.min, HMC_LIMITS.leapfrogSteps.max)),
  }
}

// U(q)=1/2 q^T Sigma^-1 q for Sigma=[[1,.92],[.92,1]].
export function potential(position: Point): number {
  const determinant = 1 - 0.92 ** 2
  return (position.x ** 2 - 2 * 0.92 * position.x * position.y + position.y ** 2) / (2 * determinant)
}

export function gradientPotential(position: Point): Point {
  const determinant = 1 - 0.92 ** 2
  return { x: (position.x - 0.92 * position.y) / determinant, y: (position.y - 0.92 * position.x) / determinant }
}

export function kinetic(momentum: Point): number {
  return 0.5 * (momentum.x ** 2 + momentum.y ** 2)
}
export function hamiltonian(state: HmcState): number {
  return potential(state.position) + kinetic(state.momentum)
}

export function leapfrog(state: HmcState, stepSize: number, steps: number): HmcState {
  const position = { ...state.position }
  const momentum = { ...state.momentum }
  let gradient = gradientPotential(position)
  momentum.x -= 0.5 * stepSize * gradient.x
  momentum.y -= 0.5 * stepSize * gradient.y
  for (let index = 0; index < steps; index += 1) {
    position.x += stepSize * momentum.x
    position.y += stepSize * momentum.y
    gradient = gradientPotential(position)
    const factor = index === steps - 1 ? 0.5 : 1
    momentum.x -= factor * stepSize * gradient.x
    momentum.y -= factor * stepSize * gradient.y
  }
  return { position, momentum }
}

export function acceptanceProbability(start: HmcState, proposal: HmcState): number {
  return Math.min(1, Math.exp(Math.min(0, hamiltonian(start) - hamiltonian(proposal))))
}
