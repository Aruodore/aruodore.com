import { line } from './figure'
export type Point = [number, number]
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp = (t: number) => Math.max(0, Math.min(1, t))
/* A bounded quintic timing curve gives transport zero velocity at both ends.
 * It is presentation timing, never an extra state transition or observation. */
export const phase = (t: number, start: number, end: number) => {
  const u = clamp((t - start) / (end - start))
  return u * u * u * (10 + u * (-15 + 6 * u))
}
export function node<T extends SVGElement = SVGElement>(svg: SVGSVGElement, key: string): T {
  const element = svg.querySelector<T>(`[data-motion="${key}"]`)
  if (!element) throw new Error(`Missing motion element: ${key}`)
  return element
}
export function attribute(element: SVGElement, name: string, value: number) {
  const next = value.toFixed(3)
  if (element.getAttribute(name) !== next) element.setAttribute(name, next)
}
export const setPath = (element: SVGElement, points: Point[], closed = false) =>
  element.setAttribute('d', line(points) + (closed ? 'Z' : ''))
export function axis(svg: SVGSVGElement, panel: number, from: number, to: number) {
  const ticks = [0, 0.5, 1].map((t) => ({ t, element: svg.querySelector(`[data-y-tick="${panel}:${t}"]`)! }))
  return (progress: number) => {
    const maximum = mix(from, to, progress)
    for (const tick of ticks) tick.element.textContent = String(Number((tick.t * maximum).toFixed(2)))
    return maximum
  }
}
