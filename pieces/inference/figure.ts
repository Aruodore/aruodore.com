export const C = {
  bg: '#FAFAF7',
  ink: '#1A1A1A',
  muted: '#6B6B66',
  rule: '#D8D8D2',
  posterior: '#1E3A5F',
  observed: '#C77B3C',
  prior: '#4A7A6A',
}
const n = (x: number) => Number(x.toFixed(2))
export const text = (x: number, y: number, content: string, extra = '') =>
  `<text x="${n(x)}" y="${n(y)}" ${extra}>${content}</text>`
export const line = (points: [number, number][]) =>
  points.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join('')
export const path = (points: [number, number][], color: string = C.posterior, extra = '') =>
  `<path d="${line(points)}" fill="none" stroke="${color}" ${extra.includes('stroke-width') ? '' : 'stroke-width="2"'} ${extra}/>`
export const dot = (x: number, y: number, r: number, color: string, extra = '') =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="${color}" ${extra}/>`
export function figure(slug: string, title: string, description: string, mobile: boolean, heightOverride?: number) {
  const width = mobile ? 600 : 900,
    height = heightOverride ?? (mobile ? 780 : 600),
    font = mobile ? 21 : 14
  const left = 65
  const escape = (value: string) => value.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
  const start = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${slug}-title ${slug}-desc" style="display:block;width:100%;height:auto;background:${C.bg};font:${font}px system-ui;fill:${C.ink}"><title id="${slug}-title">${escape(title)}</title><desc id="${slug}-desc">${escape(description)}</desc><rect width="${width}" height="${height}" fill="${C.bg}"/>`
  const plot = (
    panel: number,
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
    xLabel: string,
    heading: string,
    layout?: { left?: number; right?: number; top: number; bottom: number; formatY?: (value: number) => string },
  ) => {
    const left = layout?.left ?? 65,
      right = layout?.right ?? width - 25
    const top = layout?.top ?? (panel === 0 ? 90 : mobile ? 455 : 365)
    const bottom = layout?.bottom ?? top + (mobile ? 228 : 165)
    const x = (value: number) => left + ((value - xMin) / (xMax - xMin)) * (right - left)
    const y = (value: number) => bottom - ((value - yMin) / (yMax - yMin)) * (bottom - top)
    const clip = `${slug}-plot-${panel}`
    const ticks = [0, 0.5, 1]
      .map((t) => {
        const value = yMin + t * (yMax - yMin)
        const yy = y(value)
        const valueX = xMin + t * (xMax - xMin)
        return `<line x1="${left}" x2="${right}" y1="${n(yy)}" y2="${n(yy)}" stroke="${C.rule}"/>${text(left - 10, yy + font / 3, `${layout?.formatY ? layout.formatY(value) : n(value)}`, `text-anchor="end" data-y-tick="${panel}:${t}"`)}${text(x(valueX), bottom + font + 10, `${n(valueX)}`, 'text-anchor="middle"')}`
      })
      .join('')
    return {
      x,
      y,
      top,
      bottom,
      left,
      right,
      open: `${text(left, top - 24, heading)}${ticks}${text(right, bottom + font * 2 + 18, xLabel, 'text-anchor="end"')}<defs><clipPath id="${clip}"><rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}"/></clipPath></defs><g clip-path="url(#${clip})">`,
      close: '</g>',
    }
  }
  return {
    width,
    height,
    font,
    start,
    end: '</svg>',
    plot,
    subtitle: (value: string) => text(left, 36, value, `fill="${C.muted}"`),
  }
}
export function histogram(positions: number[], weights: number[], min = -40, max = 40, bins = 50) {
  const values = Array<number>(bins).fill(0),
    step = (max - min) / bins
  // Linear binning keeps a moving particle's deposited mass continuous.
  positions.forEach((x, i) => {
    if (x < min || x > max) return
    const position = (x - min) / step - 0.5,
      left = Math.floor(position),
      fraction = position - left
    const index = (j: number) => Math.max(0, Math.min(bins - 1, j))
    values[index(left)]! += (weights[i]! * (1 - fraction)) / step
    values[index(left + 1)]! += (weights[i]! * fraction) / step
  })
  return values.map((density, i) => ({ x: min + (i + 0.5) * step, density }))
}
