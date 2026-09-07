/*
 * Brownian motion conditioned on two endpoints.
 *
 * For Brownian motion X_t = x0 + sigma W_t on [0, T], conditioning on
 * X_T = xT gives the Gaussian process
 *
 *   X_t | X_T=xT = x0 + (t/T)(xT-x0)
 *                    + sigma(W_t - (t/T)W_T).
 *
 * The final term is a standard Brownian bridge. Subtracting the fraction
 * t/T of the terminal innovation pins every realised path to xT without
 * changing the independent Gaussian increments used to generate it.
 */

export interface BrownianBridgeParameters {
  endpoint: number
  sigma: number
}

export const BROWNIAN_BRIDGE_LIMITS = {
  endpoint: { min: -2, max: 2 },
  sigma: { min: 0.35, max: 1.6 },
} as const

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function clampBrownianBridgeParameters(
  current: BrownianBridgeParameters,
  next: Partial<BrownianBridgeParameters>,
): BrownianBridgeParameters {
  return {
    endpoint:
      next.endpoint === undefined
        ? current.endpoint
        : clamp(next.endpoint, BROWNIAN_BRIDGE_LIMITS.endpoint.min, BROWNIAN_BRIDGE_LIMITS.endpoint.max),
    sigma:
      next.sigma === undefined
        ? current.sigma
        : clamp(next.sigma, BROWNIAN_BRIDGE_LIMITS.sigma.min, BROWNIAN_BRIDGE_LIMITS.sigma.max),
  }
}

export function bridgeMean(t: number, endpoint: number, start = 0, horizon = 1): number {
  return start + (t / horizon) * (endpoint - start)
}

/* Conditional covariance follows the Gaussian conditioning identity
 * Cov(X_s,X_t | X_T) = Cov(X_s,X_t)
 * - Cov(X_s,X_T)Cov(X_T,X_t)/Var(X_T). */
export function bridgeCovariance(s: number, t: number, sigma = 1, horizon = 1): number {
  return sigma * sigma * (Math.min(s, t) - (s * t) / horizon)
}

export function bridgeStandardDeviation(t: number, sigma = 1, horizon = 1): number {
  return Math.sqrt(Math.max(0, bridgeCovariance(t, t, sigma, horizon)))
}

export function conditionBrownianPath(
  innovations: readonly number[],
  endpoint: number,
  sigma = 1,
  start = 0,
): number[] {
  if (innovations.length === 0) return []
  const finalInnovation = innovations[innovations.length - 1] ?? 0
  const lastIndex = innovations.length - 1
  if (lastIndex === 0) return [start]
  return innovations.map((innovation, index) => {
    const fraction = index / lastIndex
    return start + fraction * (endpoint - start) + sigma * (innovation - fraction * finalInnovation)
  })
}

/* Pick the first label that fits the width available to it, or nothing when
 * even the shortest does not. `measure` is supplied by the caller so the
 * choice is made with the font the canvas will actually draw with, rather
 * than guessed from a viewport breakpoint. */
export function fitLabel(candidates: readonly string[], available: number, measure: (text: string) => number): string {
  for (const text of candidates) {
    if (text === '' || measure(text) <= available) return text
  }
  return ''
}
