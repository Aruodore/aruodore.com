/*
 * Sequential beta-binomial updating, drawn on a 2D canvas.
 *
 * A fixed stream of Bernoulli(theta) outcomes is revealed one trial at
 * a time. After each trial the posterior is the conjugate update of the
 * prior by the running counts (see model.ts), so the navy curve is not
 * a fit or an approximation: it is the exact posterior density given
 * everything revealed so far.
 *
 * theta is the data-generating probability. It is known to the
 * simulation and hidden from the posterior, which is the whole point of
 * the display: the posterior concentrates towards a value it is never
 * told.
 */

import {
  betaCredibleInterval,
  betaDensity,
  betaMean,
  betaStandardDeviation,
  clampBetaBinomialParameters,
  effectiveSampleSize,
  posteriorParameters,
  type BetaBinomialParameters,
  type CredibleInterval,
} from './model'

const MAX_OBSERVATIONS = 120
const OBSERVATIONS_PER_SECOND = 8
const CURVE_SAMPLES = 240
// Headroom above the tallest curve, so a peak never touches the frame.
const SCALE_HEADROOM = 1.12
const MIN_DENSITY_SCALE = 1.6
const MAX_DENSITY_SCALE = 60
// Exponential response of the vertical scale, per second. The posterior
// peak grows without bound as trials accumulate; easing the axis keeps
// the prior comparable instead of collapsing it onto the baseline in
// one frame.
const SCALE_RESPONSE = 5
const CREDIBLE_MASS = 0.95

const BG = '#FAFAF7'
const INK = '#1A1A1A'
const MUTED = '#6B6B66'
const RULE = '#D8D8D2'
const POSTERIOR = '#1E3A5F'
const OBSERVED = '#C77B3C'
const PRIOR = '#4A7A6A'
const MARGIN = { top: 34, right: 22, bottom: 26, left: 46 } as const

export interface BetaBinomialStats {
  trials: number
  successes: number
  posteriorMean: number
  posteriorSd: number
  interval: CredibleInterval
  priorEss: number
  posteriorEss: number
}

export interface BetaBinomialOptions {
  observations?: number
  onStatsUpdate?: (stats: BetaBinomialStats) => void
}

export interface BetaBinomialHandle {
  destroy: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  regenerate: () => void
  setParameters: (parameters: Partial<BetaBinomialParameters>) => void
}

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function mountBetaBinomialUpdate(canvas: HTMLCanvasElement, opts: BetaBinomialOptions = {}): BetaBinomialHandle {
  const renderingContext = canvas.getContext('2d')
  if (!renderingContext) throw new Error('Canvas 2D is unavailable')
  const context: CanvasRenderingContext2D = renderingContext

  const total = opts.observations ?? MAX_OBSERVATIONS
  const parameters: BetaBinomialParameters = { alpha0: 2, beta0: 2, theta: 0.62 }
  // outcomes[i] is trial i; cumulative[i] counts successes among the
  // first i trials, so the running counts are a single lookup.
  let outcomes = new Uint8Array(total)
  let cumulative = new Uint16Array(total + 1)
  let seed = 90731
  let revealed = 0
  let previousFrame = 0
  let running = false
  let suspended = false
  let rafId = 0
  let densityScale = MIN_DENSITY_SCALE
  let cssWidth = 1
  let cssHeight = 1

  /* Draw one fixed stream of independent Bernoulli(theta) trials: a
   * uniform draw below theta is a success. Generating the whole stream
   * up front from a seeded generator makes replay show the same
   * experiment, so changing the prior is a controlled comparison. */
  function generate() {
    const random = seededRandom(seed)
    outcomes = new Uint8Array(total)
    cumulative = new Uint16Array(total + 1)
    let successes = 0
    for (let index = 0; index < total; index += 1) {
      const success = random() < parameters.theta ? 1 : 0
      outcomes[index] = success
      successes += success
      cumulative[index + 1] = successes
    }
  }

  function revealedTrials() {
    return Math.min(total, Math.floor(revealed))
  }

  function currentPosterior() {
    const trials = revealedTrials()
    return posteriorParameters(parameters.alpha0, parameters.beta0, cumulative[trials] ?? 0, trials)
  }

  function emitStats() {
    const trials = revealedTrials()
    const { alpha, beta } = currentPosterior()
    opts.onStatsUpdate?.({
      trials,
      successes: cumulative[trials] ?? 0,
      posteriorMean: betaMean(alpha, beta),
      posteriorSd: betaStandardDeviation(alpha, beta),
      interval: betaCredibleInterval(alpha, beta, CREDIBLE_MASS),
      priorEss: effectiveSampleSize(parameters.alpha0, parameters.beta0),
      posteriorEss: effectiveSampleSize(alpha, beta),
    })
  }

  // Curves are sampled at cell midpoints rather than at 0 and 1, where a
  // shape parameter below 1 sends the density to infinity.
  function sampleAt(index: number) {
    return (index + 0.5) / CURVE_SAMPLES
  }

  function peakDensity(alpha: number, beta: number) {
    let peak = 0
    for (let index = 0; index < CURVE_SAMPLES; index += 1) {
      const value = betaDensity(sampleAt(index), alpha, beta)
      if (Number.isFinite(value) && value > peak) peak = value
    }
    return peak
  }

  function drawFrame(plotBottom: number, stripTop: number) {
    context.strokeStyle = RULE
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(MARGIN.left, plotBottom)
    context.lineTo(cssWidth - MARGIN.right, plotBottom)
    context.moveTo(MARGIN.left, MARGIN.top)
    context.lineTo(MARGIN.left, plotBottom)
    context.moveTo(MARGIN.left, stripTop)
    context.lineTo(cssWidth - MARGIN.right, stripTop)
    context.stroke()

    const plotWidth = cssWidth - MARGIN.left - MARGIN.right
    context.fillStyle = MUTED
    context.font = '11px JetBrains Mono, monospace'
    context.textAlign = 'center'
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      context.fillText(p === 0 ? '0' : p === 1 ? '1' : p.toFixed(2), MARGIN.left + p * plotWidth, plotBottom + 17)
    }
    context.textAlign = 'left'
    context.fillText('density', MARGIN.left + 4, MARGIN.top - 20)
    context.fillText('observations', MARGIN.left, stripTop + 16)
  }

  function drawLegend() {
    const items = [
      { label: 'prior', color: PRIOR, dashed: false },
      { label: 'posterior', color: POSTERIOR, dashed: false },
      { label: 'true p', color: INK, dashed: true },
    ]
    context.font = '11px JetBrains Mono, monospace'
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    let x = cssWidth - MARGIN.right
    // Laid out right to left so the row ends flush with the plot edge.
    for (const item of [...items].reverse()) {
      const width = context.measureText(item.label).width
      x -= width
      context.fillStyle = MUTED
      context.fillText(item.label, x, MARGIN.top - 15)
      x -= 6
      context.strokeStyle = item.color
      context.lineWidth = item.dashed ? 1 : 1.75
      context.globalAlpha = item.dashed ? 0.5 : 1
      context.setLineDash(item.dashed ? [3, 3] : [])
      context.beginPath()
      context.moveTo(x - 14, MARGIN.top - 15)
      context.lineTo(x, MARGIN.top - 15)
      context.stroke()
      context.setLineDash([])
      context.globalAlpha = 1
      x -= 14 + 14
    }
    context.textBaseline = 'alphabetic'
  }

  function drawDensity(
    alpha: number,
    beta: number,
    color: string,
    xAt: (p: number) => number,
    yAt: (density: number) => number,
  ) {
    context.strokeStyle = color
    context.lineWidth = 1.75
    context.beginPath()
    for (let index = 0; index < CURVE_SAMPLES; index += 1) {
      const p = sampleAt(index)
      const y = yAt(betaDensity(p, alpha, beta))
      if (index === 0) context.moveTo(xAt(p), y)
      else context.lineTo(xAt(p), y)
    }
    context.stroke()
  }

  /* The shaded band is the central 95% of the posterior: the region
   * whose area is 0.95, not a multiple of the standard deviation. For a
   * skewed posterior (few trials, or theta near an endpoint) the two are
   * visibly different and the quantile version is the honest one. */
  function drawCredibleBand(
    alpha: number,
    beta: number,
    interval: CredibleInterval,
    plotBottom: number,
    xAt: (p: number) => number,
    yAt: (density: number) => number,
  ) {
    context.fillStyle = POSTERIOR
    context.globalAlpha = 0.13
    context.beginPath()
    context.moveTo(xAt(interval.lower), plotBottom)
    for (let index = 0; index < CURVE_SAMPLES; index += 1) {
      const p = sampleAt(index)
      if (p < interval.lower || p > interval.upper) continue
      context.lineTo(xAt(p), yAt(betaDensity(p, alpha, beta)))
    }
    context.lineTo(xAt(interval.upper), plotBottom)
    context.closePath()
    context.fill()
    context.globalAlpha = 1
  }

  /* One cell per trial: filled for a success, outlined for a failure.
   * Both are orange because both are observed data; the fill carries the
   * outcome. Unrevealed trials are drawn as nothing, so the strip never
   * shows data the posterior has not yet seen. */
  function drawStrip(stripTop: number) {
    const trials = revealedTrials()
    const available = cssWidth - MARGIN.left - MARGIN.right
    const pitch = available / total
    const side = Math.max(1, Math.min(pitch - Math.min(2, pitch * 0.22), 14))
    const top = stripTop + 26
    context.lineWidth = 1
    for (let index = 0; index < trials; index += 1) {
      const x = MARGIN.left + index * pitch
      if (outcomes[index] === 1) {
        context.fillStyle = OBSERVED
        context.fillRect(x, top, side, side)
      } else {
        context.strokeStyle = OBSERVED
        context.strokeRect(x + 0.5, top + 0.5, Math.max(1, side - 1), Math.max(1, side - 1))
      }
    }
  }

  function draw(deltaSeconds = 0) {
    context.fillStyle = BG
    context.fillRect(0, 0, cssWidth, cssHeight)

    const stripHeight = Math.max(64, cssHeight * 0.2)
    const plotBottom = cssHeight - stripHeight - MARGIN.bottom
    const stripTop = plotBottom + MARGIN.bottom
    const plotWidth = cssWidth - MARGIN.left - MARGIN.right
    const plotHeight = plotBottom - MARGIN.top
    const { alpha, beta } = currentPosterior()

    const target = Math.min(
      MAX_DENSITY_SCALE,
      Math.max(
        MIN_DENSITY_SCALE,
        SCALE_HEADROOM * Math.max(peakDensity(parameters.alpha0, parameters.beta0), peakDensity(alpha, beta)),
      ),
    )
    if (deltaSeconds <= 0) densityScale = target
    else densityScale += (target - densityScale) * (1 - Math.exp(-SCALE_RESPONSE * deltaSeconds))

    const xAt = (p: number) => MARGIN.left + p * plotWidth
    const yAt = (density: number) => plotBottom - Math.min(1, Math.max(0, density / densityScale)) * plotHeight

    drawFrame(plotBottom, stripTop)
    drawLegend()

    context.save()
    context.beginPath()
    context.rect(MARGIN.left, MARGIN.top - 2, plotWidth, plotHeight + 2)
    context.clip()

    const interval = betaCredibleInterval(alpha, beta, CREDIBLE_MASS)
    drawCredibleBand(alpha, beta, interval, plotBottom, xAt, yAt)

    context.strokeStyle = INK
    context.globalAlpha = 0.45
    context.lineWidth = 1
    context.setLineDash([4, 4])
    context.beginPath()
    context.moveTo(xAt(parameters.theta), MARGIN.top)
    context.lineTo(xAt(parameters.theta), plotBottom)
    context.stroke()
    context.setLineDash([])
    context.globalAlpha = 1

    drawDensity(parameters.alpha0, parameters.beta0, PRIOR, xAt, yAt)
    drawDensity(alpha, beta, POSTERIOR, xAt, yAt)
    context.restore()

    drawStrip(stripTop)
  }

  function frame(timestamp: number) {
    if (!running) return
    let deltaSeconds = 0
    if (previousFrame > 0) {
      deltaSeconds = (timestamp - previousFrame) / 1000
      revealed = Math.min(total, revealed + deltaSeconds * OBSERVATIONS_PER_SECOND)
    }
    previousFrame = timestamp
    draw(deltaSeconds)
    emitStats()
    if (revealed < total) rafId = requestAnimationFrame(frame)
    else running = false
  }

  function ensureRunning() {
    if (running || suspended || revealed >= total) return
    running = true
    previousFrame = 0
    rafId = requestAnimationFrame(frame)
  }

  function restart() {
    revealed = 0
    previousFrame = 0
    draw()
    emitStats()
    ensureRunning()
  }

  function applySize() {
    cssWidth = Math.max(1, canvas.clientWidth)
    cssHeight = Math.max(1, canvas.clientHeight)
    const ratio = Math.min(window.devicePixelRatio, 2)
    canvas.width = Math.round(cssWidth * ratio)
    canvas.height = Math.round(cssHeight * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    draw()
  }

  const resizeObserver = new ResizeObserver(applySize)
  resizeObserver.observe(canvas)
  generate()
  applySize()
  emitStats()
  ensureRunning()

  return {
    destroy() {
      running = false
      suspended = true
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
    },
    pause() {
      suspended = true
      if (!running) return
      running = false
      cancelAnimationFrame(rafId)
      previousFrame = 0
    },
    resume() {
      suspended = false
      ensureRunning()
    },
    reset() {
      restart()
    },
    regenerate() {
      seed += 1
      generate()
      restart()
    },
    /* Only theta changes the observation stream. Changing the prior
     * reuses the revealed data, so the visitor sees prior sensitivity on
     * one fixed dataset rather than on a fresh sample. */
    setParameters(next) {
      const previousTheta = parameters.theta
      Object.assign(parameters, clampBetaBinomialParameters(parameters, next))
      if (parameters.theta !== previousTheta) {
        generate()
        restart()
        return
      }
      draw()
      emitStats()
      ensureRunning()
    },
  }
}
