import { DT, GAP, LAST_STEP, positionInterval, type SmoothingRecord } from './model'

const C = {
  bg: '#FAFAF7',
  ink: '#1A1A1A',
  muted: '#6B6B66',
  rule: '#D8D8D2',
  posterior: '#1E3A5F',
  observed: '#C77B3C',
}
const round = (value: number) => Number(value.toFixed(2))

/* Both panels use the same domains. The band is a pointwise 1D marginal,
 * not a simultaneous trajectory band or a 2D confidence ellipse. */
export function renderSmoothing(
  record: SmoothingRecord,
  mobile = false,
  revealThrough = record.settings.cutoff,
): string {
  const width = mobile ? 600 : 900,
    height = mobile ? 680 : 600
  const font = mobile ? 21 : 14
  const left = mobile ? 62 : 66,
    right = width - 26
  const panelHeight = mobile ? 205 : 192
  const tops = mobile ? [112, 408] : [85, 344]
  const x = (k: number) => round(left + (k / LAST_STEP) * (right - left))
  const bounds = [...record.filtered, ...record.smoothed].flatMap(positionInterval)
  const minimum = Math.min(0, ...bounds, ...record.truth.map((point) => point.x)) - 0.5
  const maximum = Math.max(10, ...bounds, ...record.truth.map((point) => point.x)) + 0.5
  const line = (points: [number, number][]) => points.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join('')
  const text = (px: number, py: number, content: string, fill = C.muted, extra = '') =>
    `<text x="${px}" y="${py}" fill="${fill}" ${extra}>${content}</text>`
  const panels = [record.filtered, record.smoothed]
    .map((allStates, panel) => {
      const states = allStates.slice(0, revealThrough + 1)
      const top = tops[panel]!,
        bottom = top + panelHeight
      const y = (value: number) => round(bottom - ((value - minimum) / (maximum - minimum)) * panelHeight)
      const state = allStates[record.settings.inspect]!
      const interval = positionInterval(state)
      const upper = states.map((s, k): [number, number] => [x(k), y(positionInterval(s)[1])])
      const lower = states.map((s, k): [number, number] => [x(k), y(positionInterval(s)[0])]).reverse()
      const band = `${line(upper)}${line(lower).replace(/^M/, 'L')}Z`
      const dash = panel === 0 ? 'stroke-dasharray="7 5"' : ''
      const grid = [0, 0.5, 1]
        .map((fraction) => {
          const value = minimum + fraction * (maximum - minimum)
          return `<line x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}" stroke="${C.rule}"/>${text(left - 10, y(value) + font / 3, value.toFixed(1).replace(/\.0$/, ''), C.muted, 'text-anchor="end"')}`
        })
        .join('')
      const times = [0, 20, 40, 60, 80, 100]
        .map((k) => text(x(k), bottom + font + 12, `${k * DT}`, C.muted, 'text-anchor="middle"'))
        .join('')
      const dots = record.measurements
        .slice(0, record.settings.cutoff + 1)
        .map((z, k) =>
          z ? `<circle cx="${x(k)}" cy="${y(z.x)}" r="${mobile ? 3.5 : 2.7}" fill="${C.observed}"/>` : '',
        )
        .join('')
      return `${text(left, top - 19, panel === 0 ? 'Filtering: evidence through each state' : 'Smoothing: all available evidence', C.ink)}
      <defs><clipPath id="ks-plot-${panel}"><rect x="${left}" y="${top}" width="${right - left}" height="${panelHeight}"/></clipPath></defs>
      ${grid}<g clip-path="url(#ks-plot-${panel})">
      ${record.settings.gap ? `<rect x="${x(GAP.first)}" y="${top}" width="${x(GAP.last) - x(GAP.first)}" height="${panelHeight}" fill="${C.rule}" fill-opacity="0.5"/>` : ''}
      <rect x="${x(record.settings.cutoff)}" y="${top}" width="${right - x(record.settings.cutoff)}" height="${panelHeight}" fill="${C.rule}" fill-opacity="0.25"/>
      <path d="${band}" fill="${C.posterior}" fill-opacity="0.12"/>
      <path d="${line(record.truth.map((p, k) => [x(k), y(p.x)]))}" stroke="${C.muted}" fill="none" stroke-width="1.5"/>
      <path d="${line(states.map((s, k) => [x(k), y(s.mean[0]!)]))}" stroke="${C.posterior}" fill="none" stroke-width="2.5" ${dash}/>
      ${dots}<line x1="${x(record.settings.inspect)}" x2="${x(record.settings.inspect)}" y1="${top}" y2="${bottom}" stroke="${C.muted}" stroke-dasharray="2 4"/>
      <line x1="${x(record.settings.cutoff)}" x2="${x(record.settings.cutoff)}" y1="${top}" y2="${bottom}" stroke="${C.ink}"/>
      <path d="M${x(record.settings.inspect) - 7} ${y(interval[0])}h14M${x(record.settings.inspect)} ${y(interval[0])}V${y(interval[1])}M${x(record.settings.inspect) - 7} ${y(interval[1])}h14" stroke="${C.posterior}" stroke-width="3"/>
      <circle cx="${x(record.settings.inspect)}" cy="${y(state.mean[0]!)}" r="5" fill="${C.posterior}"/>
      </g>${times}${text(right, bottom + font * 2 + 15, 'time (s)', C.muted, 'text-anchor="end"')}`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="ks-title" aria-describedby="ks-description" style="display:block;width:100%;height:auto">
  <title id="ks-title">Filtering and smoothing across a measurement gap</title>
  <desc id="ks-description">Horizontal position against time. Dashed navy filtering and solid navy smoothing use observations through ${(record.settings.cutoff * DT).toFixed(1)} seconds. The estimates are revealed through ${(revealThrough * DT).toFixed(1)} seconds. The vertical dotted line inspects ${(record.settings.inspect * DT).toFixed(1)} seconds. Shaded navy bands are pointwise 95% intervals; orange dots are observations and grey is truth.</desc>
  <rect width="${width}" height="${height}" fill="${C.bg}"/>
  <g font-family="system-ui,sans-serif" font-size="${font}">
  ${text(left, mobile ? 30 : 27, 'Horizontal position', C.ink)}
  ${text(left, mobile ? 60 : 51, record.settings.gap ? 'Sensor gap: 3 to 6 s' : 'Sensor available throughout')}
  ${text(right, mobile ? 60 : 27, `Cutoff: ${(record.settings.cutoff * DT).toFixed(1)} s`, C.ink, 'text-anchor="end"')}
  ${panels}</g></svg>`
}
