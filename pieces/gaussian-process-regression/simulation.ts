/*
 * Animated Gaussian process regression.
 *
 * The teal band is the prior: before any data, f(x) has marginal
 * N(0, sigma_f^2) at every x, so its central 95% band is the constant
 * interval 0 +/- 1.96 sigma_f. Orange points are noisy observations. The
 * navy band and line are the posterior marginals m(x) +/- 1.96 s(x) for
 * the function itself (not for a new noisy observation), and the thin
 * navy curves are whole functions drawn from the joint posterior.
 *
 * The sample curves move along great circles in the latent standard
 * normal space (see samplePath in model.ts), so each frame is an exact
 * posterior draw. The latent vectors persist across data and
 * hyperparameter changes: a curve keeps its identity and is pulled
 * through a new observation rather than being replaced.
 */

import {
  averageSd,
  clampGpParameters,
  createSeededRandom,
  drawObservation,
  FIGURE_SEEDS,
  GP_DOMAIN,
  GP_RANGE,
  GRID_SIZE,
  gpPosterior,
  initialObservations,
  MAX_OBSERVATIONS,
  samplePath,
  SAMPLE_PATHS,
  SIGNAL_SD,
  standardNormalVector,
  Z_95,
  type GpParameters,
  type Observation,
  type Posterior,
} from './model'

const BG = '#FAFAF7'
const MUTED = '#6B6B66'
const RULE = '#D8D8D2'
const POSTERIOR = '#1E3A5F'
const OBSERVED = '#C77B3C'
const PRIOR = '#4A7A6A'
const MOBILE_BREAKPOINT = 620
const LEGEND_GAP = 18

/* Angular speed of the great-circle walk, in radians per second. One lap
 * of 2 pi takes about eighteen seconds, slow enough to follow one curve. */
const OMEGA = 0.35

/* Distance in CSS pixels within which a click removes a point. */
const HIT_RADIUS = 12
const HIT_RADIUS_TOUCH = 20

export interface GpStats {
  observations: number
  logMarginalLikelihood: number
  averageSd: number
  full: boolean
}

export interface GpOptions {
  onStatsUpdate?: (stats: GpStats) => void
}

export interface GpHandle {
  destroy: () => void
  pause: () => void
  resume: () => void
  addObservation: () => void
  removeLast: () => void
  clear: () => void
  restore: () => void
  setParameters: (parameters: Partial<GpParameters>) => void
}

export function mountGaussianProcessRegression(canvas: HTMLCanvasElement, opts: GpOptions = {}): GpHandle {
  const renderingContext = canvas.getContext('2d')
  if (!renderingContext) throw new Error('Canvas 2D is unavailable')
  const context: CanvasRenderingContext2D = renderingContext

  let parameters: GpParameters = { lengthScale: 1, noise: 0.2 }
  let observations: Observation[] = initialObservations(FIGURE_SEEDS.initial)
  let observationRandom = createSeededRandom(FIGURE_SEEDS.observations)
  const latentRandom = createSeededRandom(FIGURE_SEEDS.latents)
  const latents = Array.from({ length: SAMPLE_PATHS }, () => ({
    z1: standardNormalVector(GRID_SIZE, latentRandom),
    z2: standardNormalVector(GRID_SIZE, latentRandom),
    phase: latentRandom() * 2 * Math.PI,
  }))
  const path = new Float64Array(GRID_SIZE)
  let posterior: Posterior = gpPosterior(observations, parameters)
  let theta = 0
  let running = false
  let raf = 0
  let previous = 0
  let width = 0
  let height = 0
  let plot = { left: 0, right: 0, top: 0, bottom: 0 }

  function report() {
    opts.onStatsUpdate?.({
      observations: observations.length,
      logMarginalLikelihood: posterior.logMarginalLikelihood,
      averageSd: averageSd(posterior),
      full: observations.length >= MAX_OBSERVATIONS,
    })
  }

  function update() {
    posterior = gpPosterior(observations, parameters, posterior.grid)
    report()
    draw()
  }

  const px = (x: number) =>
    plot.left + ((x - GP_DOMAIN.min) / (GP_DOMAIN.max - GP_DOMAIN.min)) * (plot.right - plot.left)
  const py = (y: number) =>
    plot.bottom - ((y - GP_RANGE.min) / (GP_RANGE.max - GP_RANGE.min)) * (plot.bottom - plot.top)
  const clampY = (y: number) => Math.min(GP_RANGE.max, Math.max(GP_RANGE.min, y))

  function label(text: string, x: number, y: number, align: CanvasTextAlign = 'left', color = MUTED) {
    context.fillStyle = color
    context.font = `${width < MOBILE_BREAKPOINT ? 14 : 11}px ui-sans-serif, system-ui, sans-serif`
    context.textAlign = align
    context.fillText(text, x, y)
  }

  function band(center: (i: number) => number, halfWidth: (i: number) => number, color: string, alpha: number) {
    const { grid } = posterior
    context.save()
    context.globalAlpha = alpha
    context.fillStyle = color
    context.beginPath()
    for (let i = 0; i < grid.length; i += 1) context.lineTo(px(grid[i]!), py(clampY(center(i) + halfWidth(i))))
    for (let i = grid.length - 1; i >= 0; i -= 1) context.lineTo(px(grid[i]!), py(clampY(center(i) - halfWidth(i))))
    context.closePath()
    context.fill()
    context.restore()
  }

  function curve(values: ArrayLike<number>, color: string, lineWidth: number, alpha = 1, dash: number[] = []) {
    const { grid } = posterior
    context.save()
    context.globalAlpha = alpha
    context.strokeStyle = color
    context.lineWidth = lineWidth
    context.setLineDash(dash)
    context.beginPath()
    for (let i = 0; i < grid.length; i += 1) context.lineTo(px(grid[i]!), py(clampY(values[i]!)))
    context.stroke()
    context.restore()
  }

  function horizontal(y: number, color: string, dash: number[] = []) {
    context.save()
    context.strokeStyle = color
    context.lineWidth = 1
    context.setLineDash(dash)
    context.beginPath()
    context.moveTo(plot.left, py(y))
    context.lineTo(plot.right, py(y))
    context.stroke()
    context.restore()
  }

  function legendItem(x: number, y: number, color: string, text: string, marker: 'band' | 'point') {
    context.save()
    context.fillStyle = color
    if (marker === 'band') {
      context.globalAlpha = 0.35
      context.fillRect(x, y - 8, 14, 8)
    } else {
      context.beginPath()
      context.arc(x + 7, y - 4, 4, 0, Math.PI * 2)
      context.fill()
    }
    context.restore()
    label(text, x + 20, y)
    return x + 20 + context.measureText(text).width + LEGEND_GAP
  }

  function draw() {
    const mobile = width < MOBILE_BREAKPOINT
    context.clearRect(0, 0, width, height)
    context.fillStyle = BG
    context.fillRect(0, 0, width, height)
    context.textBaseline = 'alphabetic'
    plot = { left: 34, right: width - 18, top: mobile ? 92 : 64, bottom: height - (mobile ? 64 : 48) }

    label('GAUSSIAN PROCESS POSTERIOR', plot.left, 22)
    label(`n = ${observations.length}`, plot.right, 22, 'right')
    const legendY = mobile ? 50 : 44
    let legendX = legendItem(plot.left, legendY, PRIOR, 'prior 95%', 'band')
    legendX = legendItem(legendX, legendY, POSTERIOR, 'posterior 95%', 'band')
    legendItem(legendX, legendY, OBSERVED, 'observed', 'point')

    horizontal(0, RULE)
    for (const y of [-2, 0, 2]) label(String(y), plot.left - 8, py(y) + 4, 'right')
    for (let x = GP_DOMAIN.min; x <= GP_DOMAIN.max; x += 2) label(String(x), px(x), plot.bottom + 18, 'center')

    const priorHalfWidth = Z_95 * SIGNAL_SD
    band(
      () => 0,
      () => priorHalfWidth,
      PRIOR,
      0.12,
    )
    horizontal(priorHalfWidth, PRIOR, [4, 4])
    horizontal(-priorHalfWidth, PRIOR, [4, 4])

    band(
      (i) => posterior.mean[i]!,
      (i) => Z_95 * posterior.sd[i]!,
      POSTERIOR,
      0.16,
    )
    for (const latent of latents) {
      samplePath(posterior, latent.z1, latent.z2, theta + latent.phase, path)
      curve(path, POSTERIOR, 1, 0.5)
    }
    curve(posterior.mean, POSTERIOR, 2)

    for (const observation of observations) {
      context.fillStyle = OBSERVED
      context.beginPath()
      context.arc(px(observation.x), py(clampY(observation.y)), 4.5, 0, Math.PI * 2)
      context.fill()
    }

    label(
      observations.length >= MAX_OBSERVATIONS
        ? `limit of ${MAX_OBSERVATIONS} observations reached`
        : mobile
          ? 'tap to add or remove a point'
          : 'click to add an observation, click a point to remove it',
      plot.left,
      height - (mobile ? 20 : 12),
    )
  }

  function resize() {
    const rect = canvas.getBoundingClientRect()
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    width = Math.max(1, Math.round(rect.width))
    height = Math.max(1, Math.round(rect.height))
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    draw()
  }

  function onClick(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect()
    const cx = event.clientX - rect.left
    const cy = event.clientY - rect.top
    if (cx < plot.left || cx > plot.right || cy < plot.top || cy > plot.bottom) return
    const radius = (event as PointerEvent).pointerType === 'touch' ? HIT_RADIUS_TOUCH : HIT_RADIUS
    const hit = observations.findIndex(
      (observation) => Math.hypot(px(observation.x) - cx, py(clampY(observation.y)) - cy) <= radius,
    )
    if (hit >= 0) observations = observations.filter((_, index) => index !== hit)
    else if (observations.length < MAX_OBSERVATIONS) {
      const x = GP_DOMAIN.min + ((cx - plot.left) / (plot.right - plot.left)) * (GP_DOMAIN.max - GP_DOMAIN.min)
      const y = GP_RANGE.min + ((plot.bottom - cy) / (plot.bottom - plot.top)) * (GP_RANGE.max - GP_RANGE.min)
      observations = [...observations, { x, y }]
    } else return
    update()
  }

  function frame(timestamp: number) {
    if (!running) return
    const elapsed = Math.min(0.1, (timestamp - previous) / 1000)
    previous = timestamp
    theta = (theta + OMEGA * elapsed) % (2 * Math.PI)
    draw()
    raf = requestAnimationFrame(frame)
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)
  canvas.addEventListener('click', onClick)
  report()
  resize()

  return {
    destroy: () => {
      running = false
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      canvas.removeEventListener('click', onClick)
    },
    pause: () => {
      running = false
      cancelAnimationFrame(raf)
    },
    resume: () => {
      if (running) return
      running = true
      previous = performance.now()
      raf = requestAnimationFrame(frame)
    },
    addObservation: () => {
      if (observations.length >= MAX_OBSERVATIONS) return
      observations = [...observations, drawObservation(observationRandom)]
      update()
    },
    removeLast: () => {
      observations = observations.slice(0, -1)
      update()
    },
    clear: () => {
      observations = []
      update()
    },
    restore: () => {
      observations = initialObservations(FIGURE_SEEDS.initial)
      observationRandom = createSeededRandom(FIGURE_SEEDS.observations)
      update()
    },
    setParameters: (next) => {
      parameters = clampGpParameters(parameters, next)
      update()
    },
  }
}
