export function brownianStepScale(sigma: number, dt: number): number {
  return sigma * Math.sqrt(dt)
}

export function brownianCoordinateVariance(sigma: number, elapsed: number): number {
  return sigma * sigma * elapsed
}

export function brownianRmsRadius(sigma: number, elapsed: number): number {
  return sigma * Math.sqrt(3 * elapsed)
}
