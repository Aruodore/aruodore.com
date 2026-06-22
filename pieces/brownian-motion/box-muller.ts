/*
 * Box–Muller transform: maps a pair of independent uniform samples
 * U1, U2 in (0, 1] to a pair of independent standard normals
 *
 *     R = sqrt(-2 log U1)
 *     theta = 2 pi U2
 *     Z0 = R cos(theta)
 *     Z1 = R sin(theta).
 *
 * Each call to the underlying transform produces two independent
 * samples; if we throw the second one away we are wasting half of the
 * random budget. The factory below returns a stateful closure that
 * caches the second sample of every pair and returns it on the next
 * call, so every Box–Muller invocation yields two samples to the
 * caller across two successive calls.
 */

const TWO_PI = 2 * Math.PI

export function createNormalSampler(): () => number {
  let cached: number | null = null

  return function nextNormal(): number {
    if (cached !== null) {
      const z = cached
      cached = null
      return z
    }
    // U1 is shifted off zero so that log(U1) is finite; the bias is
    // 2^-52 and has no measurable effect on the sample distribution.
    const u1 = Math.random() + Number.EPSILON
    const u2 = Math.random()
    const r = Math.sqrt(-2 * Math.log(u1))
    const theta = TWO_PI * u2
    cached = r * Math.sin(theta)
    return r * Math.cos(theta)
  }
}
