/*
 * Animated Kalman filter tracking a hidden object.
 *
 * The thin grey line is the true path, which the filter never sees. Orange
 * dots are the noisy position measurements. At each step the filter first
 * predicts where the object should be (the teal ellipse, the prior) and then
 * folds in the measurement (the navy ellipse, the posterior). Both ellipses
 * are 95% regions for the position marginal of the Gaussian belief (see
 * positionEllipse in model.ts). The navy arrow is the estimated velocity,
 * a quantity that is never measured and is inferred from successive
 * positions alone.
 *
 * Inside the occluder no measurement arrives, the update is skipped, and
 * the posterior equals the prediction: the ellipse grows by the process
 * noise at every step and collapses again when measurements resume.
 */

import {
  advanceTracker,
  clampKalmanParameters,
  createTracker,
  DEFAULT_PARAMETERS,
  DT,
  FIGURE_SEED,
  OCCLUDER,
  OPENING_STEP,
  positionEllipse,
  trackerStats,
  WORLD,
  type Ellipse,
  type KalmanParameters,
  type Tracker,
  type TrackerStats,
  type TrackerStep,
} from './model'

const BG = '#FAFAF7'
const INK = '#1A1A1A'
const MUTED = '#6B6B66'
const RULE = '#D8D8D2'
const POSTERIOR = '#1E3A5F'
const OBSERVED = '#C77B3C'
const PRIOR = '#4A7A6A'
const MOBILE_BREAKPOINT = 620
const LEGEND_GAP = 18
const LEGEND_ROW = 18

/* Number of past steps drawn: 80 steps of DT = 0.1 s is eight seconds of
 * path, long enough to show a bend, short enough to stay uncluttered. */
const TRAIL_STEPS = 80

/* Measurements fade over this many steps so the eye follows the newest. */
const MEASUREMENT_STEPS = 24

/* The velocity arrow spans this many seconds of predicted motion. */
const ARROW_SECONDS = 0.5
const ARROW_HEAD = 6

/* Longest wall-clock gap, in seconds, converted into steps after a stall.
 * A throttled tab then resumes smoothly instead of replaying minutes. */
const MAX_ELAPSED = 0.25

export interface KalmanOptions {
  onStatsUpdate?: (stats: TrackerStats) => void
}

export interface KalmanHandle {
  destroy: () => void
  pause: () => void
  resume: () => void
  restart: () => void
  setParameters: (parameters: Partial<KalmanParameters>) => void
  setOccluder: (enabled: boolean) => void
}

export function mountKalmanFiltering(canvas: HTMLCanvasElement, opts: KalmanOptions = {}): KalmanHandle {
  const renderingContext = canvas.getContext('2d')
  if (!renderingContext) throw new Error('Canvas 2D is unavailable')
  const context: CanvasRenderingContext2D = renderingContext

  let parameters: KalmanParameters = { ...DEFAULT_PARAMETERS }
  let occluder = true
  let runs = 0
  let tracker: Tracker = createTracker(FIGURE_SEED)
  let steps: TrackerStep[] = []
  let clock = 0
  let running = false
  let raf = 0
  let previous = 0
  let width = 0
  let height = 0
  let scale = 1
  let origin = { x: 0, y: 0 }
  let plot = { left: 0, right: 0, top: 0, bottom: 0 }

  function step() {
    steps.push(advanceTracker(tracker, parameters, occluder))
    if (steps.length > TRAIL_STEPS) steps.shift()
  }

  function begin(count: number) {
    tracker = createTracker(FIGURE_SEED + runs)
    steps = []
    for (let i = 0; i < count; i += 1) step()
  }

  function report() {
    opts.onStatsUpdate?.(trackerStats(tracker))
  }

  const px = (x: number) => origin.x + x * scale
  const py = (y: number) => origin.y + (WORLD.height - y) * scale

  function label(text: string, x: number, y: number, align: CanvasTextAlign = 'left', color = MUTED) {
    context.fillStyle = color
    context.font = `${width < MOBILE_BREAKPOINT ? 14 : 11}px ui-sans-serif, system-ui, sans-serif`
    context.textAlign = align
    context.fillText(text, x, y)
  }

  function ellipsePath(e: Ellipse) {
    context.beginPath()
    context.ellipse(px(e.cx), py(e.cy), e.semiMajor * scale, e.semiMinor * scale, -e.angle, 0, Math.PI * 2)
  }

  function drawEllipse(e: Ellipse, color: string, fillAlpha: number, dash: number[] = []) {
    context.save()
    ellipsePath(e)
    context.globalAlpha = fillAlpha
    context.fillStyle = color
    context.fill()
    context.globalAlpha = 1
    context.strokeStyle = color
    context.lineWidth = 1.5
    context.setLineDash(dash)
    context.stroke()
    context.restore()
  }

  function polyline(points: { x: number; y: number }[], color: string, lineWidth: number, alpha = 1) {
    context.save()
    context.globalAlpha = alpha
    context.strokeStyle = color
    context.lineWidth = lineWidth
    context.beginPath()
    points.forEach((point, index) =>
      index ? context.lineTo(px(point.x), py(point.y)) : context.moveTo(px(point.x), py(point.y)),
    )
    context.stroke()
    context.restore()
  }

  function dot(x: number, y: number, radius: number, color: string, alpha = 1) {
    context.save()
    context.globalAlpha = alpha
    context.fillStyle = color
    context.beginPath()
    context.arc(px(x), py(y), radius, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  function legendItem(
    x: number,
    y: number,
    color: string,
    text: string,
    marker: 'ellipse' | 'dashed' | 'dot' | 'line',
  ) {
    context.save()
    context.fillStyle = color
    context.strokeStyle = color
    context.lineWidth = 1.5
    if (marker === 'dot') {
      context.beginPath()
      context.arc(x + 7, y - 4, 4, 0, Math.PI * 2)
      context.fill()
    } else if (marker === 'line') {
      context.beginPath()
      context.moveTo(x, y - 4)
      context.lineTo(x + 14, y - 4)
      context.stroke()
    } else {
      context.globalAlpha = 0.2
      context.fillRect(x, y - 9, 14, 10)
      context.globalAlpha = 1
      context.setLineDash(marker === 'dashed' ? [3, 2] : [])
      context.strokeRect(x, y - 9, 14, 10)
    }
    context.restore()
    label(text, x + 20, y)
    return x + 20 + context.measureText(text).width + LEGEND_GAP
  }

  function draw() {
    const last = steps[steps.length - 1]
    if (!last) return
    const mobile = width < MOBILE_BREAKPOINT
    context.clearRect(0, 0, width, height)
    context.fillStyle = BG
    context.fillRect(0, 0, width, height)
    context.textBaseline = 'alphabetic'
    const legendRows = mobile ? 2 : 1
    plot = {
      left: 18,
      right: width - 18,
      top: 44 + legendRows * LEGEND_ROW + 8,
      bottom: height - (mobile ? 48 : 36),
    }
    scale = Math.max(1, Math.min((plot.right - plot.left) / WORLD.width, (plot.bottom - plot.top) / WORLD.height))
    origin = {
      x: plot.left + (plot.right - plot.left - WORLD.width * scale) / 2,
      y: plot.top + (plot.bottom - plot.top - WORLD.height * scale) / 2,
    }

    label('KALMAN FILTER', plot.left, 22)
    label(`k = ${last.k}`, plot.right, 22, 'right')
    let legendX = plot.left
    let legendY = 44
    const items: [string, string, 'ellipse' | 'dashed' | 'dot' | 'line'][] = [
      [PRIOR, 'prior 95%', 'dashed'],
      [POSTERIOR, 'posterior 95%', 'ellipse'],
      [OBSERVED, 'observed', 'dot'],
      [MUTED, 'true path', 'line'],
    ]
    for (const [color, text, marker] of items) {
      context.font = `${mobile ? 14 : 11}px ui-sans-serif, system-ui, sans-serif`
      if (legendX + 20 + context.measureText(text).width > plot.right && legendX > plot.left) {
        legendX = plot.left
        legendY += LEGEND_ROW
      }
      legendX = legendItem(legendX, legendY, color, text, marker)
    }

    const world = { x: px(0), y: py(WORLD.height), w: WORLD.width * scale, h: WORLD.height * scale }
    context.save()
    context.strokeStyle = RULE
    context.lineWidth = 1
    context.strokeRect(world.x, world.y, world.w, world.h)
    context.beginPath()
    context.rect(world.x, world.y, world.w, world.h)
    context.clip()

    if (occluder) {
      context.fillStyle = RULE
      context.globalAlpha = 0.5
      context.fillRect(px(OCCLUDER.min), world.y, (OCCLUDER.max - OCCLUDER.min) * scale, world.h)
      context.globalAlpha = 1
      label('occluder', px((OCCLUDER.min + OCCLUDER.max) / 2), world.y + (mobile ? 18 : 16), 'center')
    }

    polyline(
      steps.map((s) => s.truth),
      MUTED,
      1,
      0.8,
    )
    polyline(
      steps.map((s) => ({ x: s.posterior.mean[0]!, y: s.posterior.mean[1]! })),
      POSTERIOR,
      1.5,
      0.7,
    )
    steps.slice(-MEASUREMENT_STEPS).forEach((s, index, recent) => {
      if (s.measurement) dot(s.measurement.x, s.measurement.y, 3, OBSERVED, 0.25 + (0.75 * (index + 1)) / recent.length)
    })

    if (last.measurement) drawEllipse(positionEllipse(last.predicted), PRIOR, 0.1, [4, 3])
    drawEllipse(positionEllipse(last.posterior), POSTERIOR, 0.18)

    const m = last.posterior.mean
    const tipX = m[0]! + m[2]! * ARROW_SECONDS
    const tipY = m[1]! + m[3]! * ARROW_SECONDS
    const heading = Math.atan2(py(tipY) - py(m[1]!), px(tipX) - px(m[0]!))
    context.save()
    context.strokeStyle = POSTERIOR
    context.fillStyle = POSTERIOR
    context.lineWidth = 1.5
    context.beginPath()
    context.moveTo(px(m[0]!), py(m[1]!))
    context.lineTo(px(tipX), py(tipY))
    context.moveTo(px(tipX), py(tipY))
    for (const side of [-1, 1]) {
      context.lineTo(
        px(tipX) - ARROW_HEAD * Math.cos(heading + side * 0.45),
        py(tipY) - ARROW_HEAD * Math.sin(heading + side * 0.45),
      )
      context.moveTo(px(tipX), py(tipY))
    }
    context.stroke()
    context.restore()

    if (last.measurement) dot(last.measurement.x, last.measurement.y, 4.5, OBSERVED)
    context.save()
    context.strokeStyle = INK
    context.lineWidth = 1.5
    context.beginPath()
    context.arc(px(last.truth.x), py(last.truth.y), 5.5, 0, Math.PI * 2)
    context.stroke()
    context.restore()
    context.restore()

    label(
      occluder && !last.measurement
        ? 'no measurement: coasting on the prediction'
        : 'ellipses: 95% regions for position',
      plot.left,
      height - (mobile ? 20 : 12),
    )
    context.strokeStyle = MUTED
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(plot.right - scale, height - (mobile ? 24 : 16))
    context.lineTo(plot.right, height - (mobile ? 24 : 16))
    context.stroke()
    label('1 unit', plot.right, height - (mobile ? 8 : 2), 'right')
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

  function frame(timestamp: number) {
    if (!running) return
    clock += Math.min(MAX_ELAPSED, (timestamp - previous) / 1000)
    previous = timestamp
    let stepped = false
    while (clock >= DT) {
      clock -= DT
      step()
      stepped = true
    }
    if (stepped) {
      report()
      draw()
    }
    raf = requestAnimationFrame(frame)
  }

  begin(OPENING_STEP + 1)
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)
  report()
  resize()

  return {
    destroy: () => {
      running = false
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
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
    restart: () => {
      runs += 1
      clock = 0
      begin(1)
      report()
      draw()
    },
    setParameters: (next) => {
      parameters = clampKalmanParameters(parameters, next)
    },
    setOccluder: (enabled) => {
      occluder = enabled
      draw()
    },
  }
}
