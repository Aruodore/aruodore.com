export interface OrnsteinUhlenbeckParameters {
  theta: number
  mu: number
  sigma: number
}

export function clampOrnsteinUhlenbeckParameters(
  current: OrnsteinUhlenbeckParameters,
  next: Partial<OrnsteinUhlenbeckParameters>,
): OrnsteinUhlenbeckParameters {
  return {
    theta: next.theta === undefined ? current.theta : Math.max(0.05, next.theta),
    mu: next.mu ?? current.mu,
    sigma: next.sigma === undefined ? current.sigma : Math.max(0.05, next.sigma),
  }
}

export function ornsteinUhlenbeckMemory(theta: number): number {
  return 1 / theta
}

export function ornsteinUhlenbeckStationaryVariance(theta: number, sigma: number): number {
  return (sigma * sigma) / (2 * theta)
}

export function ornsteinUhlenbeckTransition(
  value: number,
  parameters: OrnsteinUhlenbeckParameters,
  dt: number,
  normal: number,
): number {
  const decay = Math.exp(-parameters.theta * dt)
  const innovation = parameters.sigma * Math.sqrt((1 - decay * decay) / (2 * parameters.theta))
  return parameters.mu + decay * (value - parameters.mu) + innovation * normal
}
