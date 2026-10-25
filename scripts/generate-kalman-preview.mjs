/*
 * Generates the static fallbacks for the Kalman filtering piece,
 * public/pieces/kalman-filtering/preview.svg (900x600) and
 * preview-mobile.svg (600x560), from the same model and seed as the live
 * canvas, so the still is the figure's opening frame at OPENING_STEP.
 *
 * Imports the TypeScript model directly, which needs Node 22.18 or later
 * for type stripping. Run with
 *   node scripts/generate-kalman-preview.mjs
 * from the repo root.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import {
  DEFAULT_PARAMETERS,
  FIGURE_SEED,
  OCCLUDER,
  OPENING_STEP,
  positionEllipse,
  runTracker,
  WORLD,
} from '../pieces/kalman-filtering/model.ts'

// --- must match the trail lengths and arrow length in pieces/kalman-filtering/simulation.ts
const TRAIL_STEPS = 80
const MEASUREMENT_STEPS = 24
const ARROW_SECONDS = 0.5
const ARROW_HEAD = 6

// --- palette tokens (claude.md)
const BG = '#FAFAF7'
const INK = '#1A1A1A'
const MUTED = '#6B6B66'
const RULE = '#D8D8D2'
const POSTERIOR = '#1E3A5F'
const OBSERVED = '#C77B3C'
const PRIOR = '#4A7A6A'

const { history } = runTracker(OPENING_STEP + 1, DEFAULT_PARAMETERS, FIGURE_SEED)
const steps = history.slice(-TRAIL_STEPS)
const last = steps[steps.length - 1]

const round = (value) => Math.round(value * 10) / 10

function render({ width, height, fontSize, legendRows, legendStep, bottomInset, hintY, scaleY, scaleLabelY, mobile }) {
  const plot = { left: 18, right: width - 18, top: 44 + legendRows * 18 + 8, bottom: height - bottomInset }
  const scale = Math.min((plot.right - plot.left) / WORLD.width, (plot.bottom - plot.top) / WORLD.height)
  const origin = {
    x: plot.left + (plot.right - plot.left - WORLD.width * scale) / 2,
    y: plot.top + (plot.bottom - plot.top - WORLD.height * scale) / 2,
  }
  const px = (x) => round(origin.x + x * scale)
  const py = (y) => round(origin.y + (WORLD.height - y) * scale)
  const path = (points) => points.map((p, i) => `${i ? 'L' : 'M'}${px(p.x)} ${py(p.y)}`).join('')
  const text = (x, y, content, anchor = 'start') =>
    `<text x="${round(x)}" y="${round(y)}"${anchor === 'start' ? '' : ` text-anchor="${anchor}"`}>${content}</text>`
  const ellipse = (e, color, fillOpacity, dash = '') =>
    `<ellipse cx="${px(e.cx)}" cy="${py(e.cy)}" rx="${round(e.semiMajor * scale)}" ry="${round(e.semiMinor * scale)}" transform="rotate(${round((-e.angle * 180) / Math.PI)} ${px(e.cx)} ${py(e.cy)})" fill="${color}" fill-opacity="${fillOpacity}" stroke="${color}" stroke-width="1.5"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`

  const worldX = px(0)
  const worldY = py(WORLD.height)
  const worldW = round(WORLD.width * scale)
  const worldH = round(WORLD.height * scale)
  const m = last.posterior.mean
  const tip = { x: m[0] + m[2] * ARROW_SECONDS, y: m[1] + m[3] * ARROW_SECONDS }
  const heading = Math.atan2(py(tip.y) - py(m[1]), px(tip.x) - px(m[0]))
  const head = [-1, 1]
    .map(
      (side) =>
        `M${px(tip.x)} ${py(tip.y)}L${round(px(tip.x) - ARROW_HEAD * Math.cos(heading + side * 0.45))} ${round(py(tip.y) - ARROW_HEAD * Math.sin(heading + side * 0.45))}`,
    )
    .join('')

  const recent = steps.slice(-MEASUREMENT_STEPS)
  const dots = recent
    .map((s, index) =>
      s.measurement
        ? `<circle cx="${px(s.measurement.x)}" cy="${py(s.measurement.y)}" r="3" opacity="${round((0.25 + (0.75 * (index + 1)) / recent.length) * 100) / 100}"/>`
        : '',
    )
    .join('')

  const legendItems = mobile
    ? [
        [18, 44],
        [18 + legendStep, 44],
        [18, 62],
        [18 + legendStep, 62],
      ]
    : [
        [18, 44],
        [18 + legendStep, 44],
        [18 + 2 * legendStep, 44],
        [18 + 3 * legendStep, 44],
      ]
  const [prior, posterior, observed, truth] = legendItems
  const legend = `
  <rect x="${prior[0]}" y="${prior[1] - 9}" width="14" height="10" fill="${PRIOR}" fill-opacity="0.2" stroke="${PRIOR}" stroke-width="1.5" stroke-dasharray="3 2"/>
  <rect x="${posterior[0]}" y="${posterior[1] - 9}" width="14" height="10" fill="${POSTERIOR}" fill-opacity="0.2" stroke="${POSTERIOR}" stroke-width="1.5"/>
  <circle cx="${observed[0] + 7}" cy="${observed[1] - 4}" r="4" fill="${OBSERVED}"/>
  <line x1="${truth[0]}" y1="${truth[1] - 4}" x2="${truth[0] + 14}" y2="${truth[1] - 4}" stroke="${MUTED}" stroke-width="1.5"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Kalman filter tracking a hidden object</title>
  <desc id="description">A grey true path crosses a shaded occluder. Orange measurements stop at its edge, and the navy 95% position ellipse widens while the object is hidden.</desc>
  <defs><clipPath id="world"><rect x="${worldX}" y="${worldY}" width="${worldW}" height="${worldH}"/></clipPath></defs>
  <rect width="${width}" height="${height}" fill="${BG}"/>
  <rect x="${worldX}" y="${worldY}" width="${worldW}" height="${worldH}" fill="none" stroke="${RULE}"/>
  <g clip-path="url(#world)">
    <rect x="${px(OCCLUDER.min)}" y="${worldY}" width="${round((OCCLUDER.max - OCCLUDER.min) * scale)}" height="${worldH}" fill="${RULE}" fill-opacity="0.5"/>
    <text x="${px((OCCLUDER.min + OCCLUDER.max) / 2)}" y="${worldY + (mobile ? 18 : 16)}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${fontSize}" fill="${MUTED}">occluder</text>
    <path d="${path(steps.map((s) => s.truth))}" fill="none" stroke="${MUTED}" stroke-opacity="0.8"/>
    <path d="${path(steps.map((s) => ({ x: s.posterior.mean[0], y: s.posterior.mean[1] })))}" fill="none" stroke="${POSTERIOR}" stroke-width="1.5" stroke-opacity="0.7"/>
    <g fill="${OBSERVED}">${dots}</g>
    ${last.measurement ? ellipse(positionEllipse(last.predicted), PRIOR, 0.1, '4 3') : ''}
    ${ellipse(positionEllipse(last.posterior), POSTERIOR, 0.18)}
    <path d="M${px(m[0])} ${py(m[1])}L${px(tip.x)} ${py(tip.y)}${head}" fill="none" stroke="${POSTERIOR}" stroke-width="1.5"/>
    <circle cx="${px(last.truth.x)}" cy="${py(last.truth.y)}" r="5.5" fill="none" stroke="${INK}" stroke-width="1.5"/>
  </g>${legend}
  <line x1="${round(plot.right - scale)}" y1="${scaleY}" x2="${plot.right}" y2="${scaleY}" stroke="${MUTED}"/>
  <g font-family="system-ui, sans-serif" font-size="${fontSize}" fill="${MUTED}">
    ${text(18, 22, 'KALMAN FILTER')}
    ${text(plot.right, 22, `k = ${last.k}`, 'end')}
    ${text(prior[0] + 20, prior[1], 'prior 95%')}
    ${text(posterior[0] + 20, posterior[1], 'posterior 95%')}
    ${text(observed[0] + 20, observed[1], 'observed')}
    ${text(truth[0] + 20, truth[1], 'true path')}
    ${text(18, hintY, last.measurement ? 'ellipses: 95% regions for position' : 'no measurement: coasting on the prediction')}
    ${text(plot.right, scaleLabelY, '1 unit', 'end')}
  </g>
</svg>
`
}

const directory = 'public/pieces/kalman-filtering'
mkdirSync(directory, { recursive: true })
writeFileSync(
  `${directory}/preview.svg`,
  render({
    width: 900,
    height: 600,
    fontSize: 11,
    legendRows: 1,
    legendStep: 132,
    bottomInset: 36,
    hintY: 588,
    scaleY: 584,
    scaleLabelY: 598,
    mobile: false,
  }),
)
writeFileSync(
  `${directory}/preview-mobile.svg`,
  render({
    width: 600,
    height: 560,
    fontSize: 14,
    legendRows: 2,
    legendStep: 160,
    bottomInset: 48,
    hintY: 540,
    scaleY: 536,
    scaleLabelY: 552,
    mobile: true,
  }),
)
