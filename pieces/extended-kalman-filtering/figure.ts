import { type Settings, type Step, DT, STEPS } from './model'

const C = {
  bg: '#FAFAF7',
  ink: '#1A1A1A',
  muted: '#6B6B66',
  rule: '#D8D8D2',
  posterior: '#1E3A5F',
  prior: '#4A7A6A',
  observed: '#C77B3C',
}
const n = (v: number) => v.toFixed(2)
export function renderFigure(record: Step[], settings: Settings, mobile = false, reveal = false): string {
  const width = mobile ? 440 : 900
  const height = mobile ? 660 : 610
  const left = 52
  const right = width - 20
  const plotWidth = right - left
  const font = mobile ? 14 : 15
  const chosen = record[settings.inspect - 1]!
  const visible = reveal ? record.slice(0, settings.inspect) : record
  const mu = chosen.predicted.mean[0]
  const sd = Math.sqrt(chosen.predicted.cov[0])
  const slope = Math.cos(mu)
  const angleLimit = Math.max(
    3,
    ...record.flatMap((s) => [
      Math.abs(s.truth[0]),
      Math.abs(s.linear.mean[0]),
      Math.abs(s.filtered.mean[0]) + 1.96 * Math.sqrt(s.filtered.cov[0]),
    ]),
  )
  const top = 72
  const bottom = mobile ? 280 : 265
  const tx = (time: number) => left + (time / (DT * STEPS)) * plotWidth
  const ty = (angle: number) => bottom - ((angle + angleLimit) / (2 * angleLimit)) * (bottom - top)
  const sensorTop = mobile ? 398 : 378
  const sensorBottom = height - 48
  // Fixed axes keep the sensor curve stationary as its tangent moves during playback.
  const radius = Math.max(Math.PI, settings.angle + 0.25 + 2.5 * settings.uncertainty)
  const sx = (theta: number) => left + ((theta + radius) / (2 * radius)) * plotWidth
  const sy = (z: number) => sensorBottom - ((z + 1.6) / 3.2) * (sensorBottom - sensorTop)
  const line = (x1: number, y1: number, x2: number, y2: number, color: string, extra = '') =>
    `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" ${extra}/>`
  const text = (x: number, y: number, value: string, extra = '') =>
    `<text x="${n(x)}" y="${n(y)}" ${extra}>${value}</text>`
  const path = (points: number[][]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x!)} ${n(y!)}`).join(' ')
  const trace = (key: 'truth' | 'filtered' | 'linear') =>
    path(visible.map((s) => [tx(s.time), ty(key === 'truth' ? s.truth[0] : s[key].mean[0])]))
  const band =
    path([
      ...visible.map((s) => [tx(s.time), ty(s.filtered.mean[0] + 1.96 * Math.sqrt(s.filtered.cov[0]))]),
      ...visible.toReversed().map((s) => [tx(s.time), ty(s.filtered.mean[0] - 1.96 * Math.sqrt(s.filtered.cov[0]))]),
    ]) + 'Z'
  const curve = path(
    Array.from({ length: 241 }, (_, i) => {
      const theta = -radius + (i / 240) * 2 * radius
      return [sx(theta), sy(Math.sin(theta))]
    }),
  )
  const tangent = (theta: number) => Math.sin(mu) + slope * (theta - mu)
  const legend = mobile
    ? 'Grey: truth · Navy: EKF'
    : 'Grey: true angle · Solid navy: EKF · Dashed navy: small-angle filter'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="ekf-title ekf-desc" style="display:block;width:100%;height:auto;background:${C.bg};font:${font}px system-ui;fill:${C.ink}">
  <title id="ekf-title">Extended Kalman filter and local sensor approximation</title>
  <desc id="ekf-desc">Angle estimates over 12 seconds. Inspecting measurement ${settings.inspect} at ${chosen.time.toFixed(2)} seconds, the predicted angle is ${mu.toFixed(2)} radians and the sensor slope is ${slope.toFixed(2)}. Shading is an approximate pointwise 95% angle interval.</desc>
  <defs><clipPath id="ekf-sensor-clip"><rect x="${left}" y="${sensorTop}" width="${plotWidth}" height="${sensorBottom - sensorTop}"/></clipPath></defs>
  ${text(left, 25, 'Tracking the hidden angle', 'font-family="Georgia,serif" font-size="21"')}
  ${text(left, 49, legend, `fill="${C.muted}" font-size="${mobile ? 12 : 14}"`)}
  ${[-1, 0, 1].map((v) => line(left, ty(v * angleLimit), right, ty(v * angleLimit), C.rule) + text(left - 8, ty(v * angleLimit) + 5, (v * angleLimit).toFixed(1), 'text-anchor="end"')).join('')}
  <path d="${band}" fill="${C.posterior}" fill-opacity="0.12"/>
  <path d="${trace('truth')}" fill="none" stroke="${C.muted}" stroke-width="1.5"/>
  <path d="${trace('linear')}" fill="none" stroke="${C.posterior}" stroke-width="1.7" stroke-dasharray="6 5"/>
  <path d="${trace('filtered')}" fill="none" stroke="${C.posterior}" stroke-width="2.2"/>
  <circle cx="${n(tx(chosen.time))}" cy="${n(ty(chosen.filtered.mean[0]))}" r="4" fill="${C.posterior}"/>
  ${line(tx(chosen.time), top, tx(chosen.time), bottom, C.ink, 'stroke-dasharray="3 4"')}
  ${[0, 3, 6, 9, 12].map((t) => text(tx(t), bottom + 24, String(t), 'text-anchor="middle"')).join('')}
  ${text(right, bottom + 46, 'time (s)', 'text-anchor="end"')}
  ${text(left, sensorTop - 42, 'The sensor and its tangent', 'font-family="Georgia,serif" font-size="21"')}
  ${text(left, sensorTop - 18, mobile ? 'Teal: prediction · Orange: reading' : 'Teal: tangent over predicted 95% angle interval · Orange: sensor reading', `fill="${C.muted}" font-size="${mobile ? 12 : 14}"`)}
  ${[-1, 0, 1].map((z) => line(left, sy(z), right, sy(z), C.rule) + text(left - 8, sy(z) + 5, String(z), 'text-anchor="end"')).join('')}
  <g clip-path="url(#ekf-sensor-clip)">
  <rect x="${n(sx(mu - 1.96 * sd))}" y="${sensorTop}" width="${n(sx(mu + 1.96 * sd) - sx(mu - 1.96 * sd))}" height="${sensorBottom - sensorTop}" fill="${C.prior}" fill-opacity="0.09"/>
  <path d="${curve}" fill="none" stroke="${C.ink}" stroke-width="1.8"/>
  ${line(left, sy(chosen.observation), right, sy(chosen.observation), C.observed, 'stroke-width="2" stroke-dasharray="5 4"')}
  ${line(sx(mu - 1.96 * sd), sy(tangent(mu - 1.96 * sd)), sx(mu + 1.96 * sd), sy(tangent(mu + 1.96 * sd)), C.prior, 'stroke-width="3"')}
  <circle cx="${n(sx(mu))}" cy="${n(sy(Math.sin(mu)))}" r="4" fill="${C.prior}"/>
  <circle cx="${n(sx(chosen.truth[0]))}" cy="${n(sy(Math.sin(chosen.truth[0])))}" r="4" fill="${C.muted}"/>
  </g>
  ${[-1, 0, 1].map((v) => text(sx(v * radius), sensorBottom + 23, (v * radius).toFixed(1), 'text-anchor="middle"')).join('')}
  ${text(right, height - 5, 'angle (rad)', 'text-anchor="end"')}
  </svg>`
}
