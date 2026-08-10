export interface FirstPassageParameters {
  boundary: number
  sigma: number
}

export function clampFirstPassageParameters(
  current: FirstPassageParameters,
  next: Partial<FirstPassageParameters>,
): FirstPassageParameters {
  return {
    boundary: next.boundary === undefined ? current.boundary : Math.min(2.5, Math.max(0.5, next.boundary)),
    sigma: next.sigma === undefined ? current.sigma : Math.min(2, Math.max(0.4, next.sigma)),
  }
}

function erf(x: number) {
  const sign = x < 0 ? -1 : 1
  const z = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * z)
  const polynomial = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
  return sign * (1 - polynomial * Math.exp(-z * z))
}

export function standardNormalCdf(x: number) {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

export function firstPassageCdf(t: number, boundary: number, sigma: number) {
  if (t <= 0 || boundary <= 0 || sigma <= 0) return 0
  return Math.min(1, Math.max(0, 2 * (1 - standardNormalCdf(boundary / (sigma * Math.sqrt(t))))))
}

export function firstPassageDensity(t: number, boundary: number, sigma: number) {
  if (t <= 0 || boundary <= 0 || sigma <= 0) return 0
  return (
    (boundary / (sigma * Math.sqrt(2 * Math.PI * t ** 3))) * Math.exp(-(boundary * boundary) / (2 * sigma * sigma * t))
  )
}
