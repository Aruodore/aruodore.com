/*
 * Generates the static fallbacks for the Gaussian process regression
 * piece, public/pieces/gaussian-process-regression/preview.svg (900x600)
 * and preview-mobile.svg (600x900), from the same model and seeds as the
 * live canvas, so the still is the figure's opening frame at theta = 0.
 *
 * Imports the TypeScript model directly, which needs Node 22.18 or later
 * for type stripping. Run with
 *   node scripts/generate-gaussian-process-preview.mjs
 * from the repo root.
 */

import { writeFileSync } from 'node:fs'
import {
  createSeededRandom,
  FIGURE_SEEDS,
  GP_DOMAIN,
  GP_RANGE,
  GRID_SIZE,
  gpPosterior,
  initialObservations,
  samplePath,
  SAMPLE_PATHS,
  SIGNAL_SD,
  standardNormalVector,
  Z_95,
} from '../pieces/gaussian-process-regression/model.ts'

// --- must match the opening parameters in pieces/gaussian-process-regression/simulation.ts
const PARAMETERS = { lengthScale: 1, noise: 0.2 }

// --- palette tokens (claude.md)
const BG = '#FAFAF7'
const MUTED = '#6B6B66'
const RULE = '#D8D8D2'
const POSTERIOR = '#1E3A5F'
const OBSERVED = '#C77B3C'
const PRIOR = '#4A7A6A'

const observations = initialObservations(FIGURE_SEEDS.initial)
const posterior = gpPosterior(observations, PARAMETERS)
const latentRandom = createSeededRandom(FIGURE_SEEDS.latents)
const paths = Array.from({ length: SAMPLE_PATHS }, () => {
  const z1 = standardNormalVector(GRID_SIZE, latentRandom)
  const z2 = standardNormalVector(GRID_SIZE, latentRandom)
  const phase = latentRandom() * 2 * Math.PI
  return samplePath(posterior, z1, z2, phase)
})

const round = (value) => Math.round(value * 10) / 10
const clampY = (y) => Math.min(GP_RANGE.max, Math.max(GP_RANGE.min, y))

function render({ width, height, fontSize, plot, legendY, legendStep, hint, hintY }) {
  const px = (x) =>
    round(plot.left + ((x - GP_DOMAIN.min) / (GP_DOMAIN.max - GP_DOMAIN.min)) * (plot.right - plot.left))
  const py = (y) =>
    round(plot.bottom - ((clampY(y) - GP_RANGE.min) / (GP_RANGE.max - GP_RANGE.min)) * (plot.bottom - plot.top))
  const { grid } = posterior
  const line = (values) => Array.from(grid, (x, i) => `${i ? 'L' : 'M'}${px(x)} ${py(values[i])}`).join('')
  const bandPath = (center, half) => {
    const upper = Array.from(grid, (x, i) => `${i ? 'L' : 'M'}${px(x)} ${py(center(i) + half(i))}`)
    const lower = Array.from(grid, (x, i) => `L${px(x)} ${py(center(i) - half(i))}`).reverse()
    return `${upper.join('')}${lower.join('')}Z`
  }
  const prior = Z_95 * SIGNAL_SD
  const text = (x, y, content, anchor = 'start', fill = MUTED) =>
    `<text x="${round(x)}" y="${round(y)}"${anchor === 'start' ? '' : ` text-anchor="${anchor}"`}${fill === MUTED ? '' : ` fill="${fill}"`}>${content}</text>`
  const hline = (y, stroke, dash = '') =>
    `<line x1="${plot.left}" y1="${py(y)}" x2="${plot.right}" y2="${py(y)}" stroke="${stroke}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`

  const labels = [
    text(plot.left, 22, 'GAUSSIAN PROCESS POSTERIOR'),
    text(plot.right, 22, `n = ${observations.length}`, 'end'),
    text(plot.left + 20, legendY, 'prior 95%'),
    text(plot.left + legendStep + 20, legendY, 'posterior 95%'),
    text(plot.left + 2 * legendStep + 20, legendY, 'observed'),
    ...[-2, 0, 2].map((y) => text(plot.left - 8, py(y) + 4, String(y), 'end')),
    ...[0, 2, 4, 6, 8, 10].map((x) => text(px(x), plot.bottom + 18, String(x), 'middle')),
    text(plot.left, hintY, hint),
  ]

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Gaussian process regression posterior</title>
  <desc id="description">A teal prior band, six orange observations, and a navy posterior band with three sample functions that narrows near the data.</desc>
  <rect width="${width}" height="${height}" fill="${BG}"/>
  ${hline(0, RULE)}
  <path d="${bandPath(
    () => 0,
    () => prior,
  )}" fill="${PRIOR}" opacity="0.12"/>
  ${hline(prior, PRIOR, '4 4')}${hline(-prior, PRIOR, '4 4')}
  <path d="${bandPath(
    (i) => posterior.mean[i],
    (i) => Z_95 * posterior.sd[i],
  )}" fill="${POSTERIOR}" opacity="0.16"/>
  <g fill="none" stroke="${POSTERIOR}" stroke-opacity="0.5">${paths.map((values) => `<path d="${line(values)}"/>`).join('')}</g>
  <path d="${line(posterior.mean)}" fill="none" stroke="${POSTERIOR}" stroke-width="2"/>
  <g fill="${OBSERVED}">${observations.map((o) => `<circle cx="${px(o.x)}" cy="${py(o.y)}" r="4.5"/>`).join('')}</g>
  <rect x="${plot.left}" y="${legendY - 8}" width="14" height="8" fill="${PRIOR}" opacity="0.35"/>
  <rect x="${plot.left + legendStep}" y="${legendY - 8}" width="14" height="8" fill="${POSTERIOR}" opacity="0.35"/>
  <circle cx="${round(plot.left + 2 * legendStep + 7)}" cy="${legendY - 4}" r="4" fill="${OBSERVED}"/>
  <g font-family="system-ui, sans-serif" font-size="${fontSize}" fill="${MUTED}">
    ${labels.join('\n    ')}
  </g>
</svg>
`
}

const directory = 'public/pieces/gaussian-process-regression'
writeFileSync(
  `${directory}/preview.svg`,
  render({
    width: 900,
    height: 600,
    fontSize: 11,
    plot: { left: 34, right: 882, top: 64, bottom: 552 },
    legendY: 44,
    legendStep: 132,
    hint: 'click to add an observation, click a point to remove it',
    hintY: 588,
  }),
)
writeFileSync(
  `${directory}/preview-mobile.svg`,
  render({
    width: 600,
    height: 900,
    fontSize: 14,
    plot: { left: 34, right: 582, top: 92, bottom: 836 },
    legendY: 50,
    legendStep: 160,
    hint: 'tap to add or remove a point',
    hintY: 880,
  }),
)
