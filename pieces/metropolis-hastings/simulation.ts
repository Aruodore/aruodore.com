/*
 * A random-walk Metropolis chain on a fixed bimodal target, drawn on a
 * 2D canvas.
 *
 * The two panels share the state axis. On the left, the navy curve is
 * the exact target density pi and the orange bars are the empirical
 * density of the draws accumulated so far; the teal bump is the
 * proposal kernel q(.|x) centred on the current state, drawn at a fixed
 * visual height because its own scale varies over two orders of
 * magnitude as the proposal width changes. On the right, the trace
 * shows the most recent draws in order. A rejected move leaves the
 * chain where it was, so rejection is visible as a flat segment.
 *
 * Nothing here is fitted. The bars converge to the curve because the
 * chain is stationary with respect to pi, not because the two are
 * reconciled by any step of the algorithm.
 */

import {
  binIndex,
  clampMetropolisHastingsParameters,
  fitLabel,
  effectiveSampleSize,
  autocorrelation,
  histogramDensity,
  normalDensity,
  targetDensity,
  targetLogDensity,
  targetMean,
  targetStandardDeviation,
  metropolisStep,
  TARGET_DOMAIN,
  type ChainState,
  type MetropolisHastingsParameters,
} from './model'

const MAX_DRAWS = 6000
const DRAWS_PER_SECOND = 140
const BINS = 44
const TRACE_WINDOW = 600
// The empirical density of a handful of draws is a spike, not a shape.
// Hold the bars back until the histogram can be read as a distribution.
const HISTOGRAM_DELAY = 40
const CURVE_SAMPLES = 220
// Vertical scale of the density panel, as a multiple of the peak of pi.
// Early histograms overshoot; the eased scale absorbs that without
// collapsing the target curve onto the axis.
const MIN_DENSITY_SCALE = 1.2
const MAX_DENSITY_SCALE = 2.4
const SCALE_RESPONSE = 4
// Diagnostics are O(lag * draws); recomputing them every frame is waste.
const STATS_INTERVAL = 320
const MAX_AUTOCORRELATION_LAG = 120
const PROPOSAL_BUMP_FRACTION = 0.45
// Gap kept between a panel caption and the panel beside it.
const CAPTION_PADDING = 10
const CHAIN_START = -3.4

const BG = '#FAFAF7'
const INK = '#1A1A1A'
const MUTED = '#6B6B66'
const RULE = '#D8D8D2'
const POSTERIOR = '#1E3A5F'
const OBSERVED = '#C77B3C'
const PRIOR = '#4A7A6A'
const MARGIN = { top: 42, right: 20, bottom: 30, left: 34 } as const
const PANEL_GAP = 26
const DENSITY_PANEL_FRACTION = 0.36

export interface MetropolisHastingsStats {
  draws: number
  accepted: number
  acceptanceRate: number
  lagOneAutocorrelation: number
  effectiveSampleSize: number
  chainMean: number
  targetMean: number
  complete: boolean
}

export interface MetropolisHastingsOptions {
  maxDraws?: number
  onStatsUpdate?: (stats: MetropolisHastingsStats) => void
}

export interface MetropolisHastingsHandle {
  destroy: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  regenerate: () => void
  setParameters: (parameters: Partial<MetropolisHastingsParameters>) => void
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

export function mountMetropolisHastings(
  canvas: HTMLCanvasElement,
  opts: MetropolisHastingsOptions = {},
): MetropolisHastingsHandle {
  const renderingContext = canvas.getContext('2d')
  if (!renderingContext) throw new Error('Canvas 2D is unavailable')
  const context: CanvasRenderingContext2D = renderingContext

  const total = opts.maxDraws ?? MAX_DRAWS
  const binWidth = (TARGET_DOMAIN.max - TARGET_DOMAIN.min) / BINS
  const targetPeak = (() => {
    let peak = 0
    for (let index = 0; index < CURVE_SAMPLES; index += 1) {
      const x = TARGET_DOMAIN.min + ((index + 0.5) / CURVE_SAMPLES) * (TARGET_DOMAIN.max - TARGET_DOMAIN.min)
      peak = Math.max(peak, targetDensity(x))
    }
    return peak
  })()
  const expectation = targetMean()
  const targetSd = targetStandardDeviation()

  let parameters: MetropolisHastingsParameters = { proposalSd: 1.4 }
  let seed = 20260905
  let random = seededRandom(seed)
  let spareNormal: number | undefined
  let state: ChainState = { value: CHAIN_START, logDensity: targetLogDensity(CHAIN_START) }
  let draws: number[] = []
  let counts = new Uint32Array(BINS)
  let accepted = 0
  let runningSum = 0
  let lastProposal = CHAIN_START
  let lastAccepted = true
  let densityScale = MIN_DENSITY_SCALE
  let cssWidth = 1
  let cssHeight = 1
  let running = false
  let suspended = true
  let rafId = 0
  let previousFrame = 0
  // Fractional draws carried between frames, so the chain advances at the
  // stated rate instead of losing the remainder to rounding every frame.
  let pendingDraws = 0
  let statsClock = 0

  /* Box-Muller: one polar pair of independent standard normals per two
   * uniforms, with the second held for the next call. */
  function standardNormal() {
    if (spareNormal !== undefined) {
      const value = spareNormal
      spareNormal = undefined
      return value
    }
    const radius = Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, random())))
    const angle = 2 * Math.PI * random()
    spareNormal = radius * Math.sin(angle)
    return radius * Math.cos(angle)
  }

  /* Called on a timer rather than every frame: the autocorrelation sum
   * is O(lag * draws). */
  function emitStats() {
    if (!opts.onStatsUpdate) return
    const ess = effectiveSampleSize(draws, MAX_AUTOCORRELATION_LAG)
    opts.onStatsUpdate({
      draws: draws.length,
      accepted,
      acceptanceRate: draws.length > 0 ? accepted / draws.length : 0,
      lagOneAutocorrelation: draws.length > 1 ? autocorrelation(draws, 1) : 1,
      effectiveSampleSize: ess,
      chainMean: draws.length > 0 ? runningSum / draws.length : CHAIN_START,
      targetMean: expectation,
      complete: draws.length >= total,
    })
  }

  function advance(steps: number) {
    for (let step = 0; step < steps && draws.length < total; step += 1) {
      const move = metropolisStep(state, standardNormal(), random(), parameters.proposalSd)
      state = { value: move.value, logDensity: move.logDensity }
      lastProposal = move.proposal
      lastAccepted = move.accepted
      if (move.accepted) accepted += 1
      draws.push(state.value)
      runningSum += state.value
      const bin = binIndex(state.value, TARGET_DOMAIN.min, TARGET_DOMAIN.max, BINS)
      if (bin >= 0) counts[bin] = (counts[bin] ?? 0) + 1
    }
  }

  function panels() {
    const plotTop = MARGIN.top
    const plotBottom = cssHeight - MARGIN.bottom
    const densityRight = MARGIN.left + (cssWidth - MARGIN.left - MARGIN.right - PANEL_GAP) * DENSITY_PANEL_FRACTION
    return {
      plotTop,
      plotBottom,
      densityLeft: MARGIN.left,
      densityRight,
      traceLeft: densityRight + PANEL_GAP,
      traceRight: cssWidth - MARGIN.right,
      /* The state axis is shared: one mapping serves both panels. */
      yAt: (value: number) =>
        plotBottom - ((value - TARGET_DOMAIN.min) / (TARGET_DOMAIN.max - TARGET_DOMAIN.min)) * (plotBottom - plotTop),
    }
  }

  function updateDensityScale(elapsedSeconds: number) {
    const densities = histogramDensity(Array.from(counts), draws.length, binWidth)
    const observedPeak = draws.length >= HISTOGRAM_DELAY ? Math.max(...densities) : 0
    const targetScale = Math.min(
      MAX_DENSITY_SCALE,
      Math.max(MIN_DENSITY_SCALE, (observedPeak * 1.08) / Math.max(targetPeak, Number.EPSILON)),
    )
    const response = 1 - Math.exp(-SCALE_RESPONSE * Math.max(0, elapsedSeconds))
    densityScale += (targetScale - densityScale) * response
    return densities
  }

  function drawDensityPanel(densities: readonly number[]) {
    const { plotTop, plotBottom, densityLeft, densityRight, traceLeft, yAt } = panels()
    const panelWidth = densityRight - densityLeft
    /* Density is drawn leftward from a baseline at the panel's right
     * edge, so the state axis runs vertically and matches the trace. */
    const xAt = (density: number) => densityRight - Math.min(1, density / (densityScale * targetPeak)) * panelWidth

    context.strokeStyle = RULE
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(densityRight, plotTop)
    context.lineTo(densityRight, plotBottom)
    context.stroke()

    if (draws.length >= HISTOGRAM_DELAY) {
      context.fillStyle = OBSERVED
      context.globalAlpha = 0.32
      densities.forEach((density, index) => {
        const lower = TARGET_DOMAIN.min + index * binWidth
        const top = yAt(lower + binWidth)
        const height = yAt(lower) - top
        const width = densityRight - xAt(density)
        if (width > 0.5) context.fillRect(densityRight - width, top + 0.5, width, Math.max(0, height - 1))
      })
      context.globalAlpha = 1
    }

    context.strokeStyle = POSTERIOR
    context.lineWidth = 1.9
    context.beginPath()
    for (let index = 0; index <= CURVE_SAMPLES; index += 1) {
      const x = TARGET_DOMAIN.min + (index / CURVE_SAMPLES) * (TARGET_DOMAIN.max - TARGET_DOMAIN.min)
      const px = xAt(targetDensity(x))
      if (index === 0) context.moveTo(px, yAt(x))
      else context.lineTo(px, yAt(x))
    }
    context.stroke()

    /* The proposal kernel is drawn at a fixed peak width rather than on
     * the density scale: its own peak is 1/(sigma sqrt(2 pi)), which
     * spans two orders of magnitude across the slider range. */
    const proposalPeak = normalDensity(0, 0, parameters.proposalSd)
    context.strokeStyle = PRIOR
    context.lineWidth = 1.4
    context.setLineDash([5, 3])
    context.beginPath()
    for (let index = 0; index <= CURVE_SAMPLES; index += 1) {
      const x = TARGET_DOMAIN.min + (index / CURVE_SAMPLES) * (TARGET_DOMAIN.max - TARGET_DOMAIN.min)
      const shape = normalDensity(x, state.value, parameters.proposalSd) / proposalPeak
      const px = densityRight - shape * panelWidth * PROPOSAL_BUMP_FRACTION
      if (index === 0) context.moveTo(px, yAt(x))
      else context.lineTo(px, yAt(x))
    }
    context.stroke()
    context.setLineDash([])

    /* Captions are chosen by measurement rather than by a viewport
     * breakpoint, so they never run into the panel beside them however
     * narrow the canvas gets. */
    const available = traceLeft - densityLeft - CAPTION_PADDING
    const measure = (text: string) => context.measureText(text).width
    context.fillStyle = INK
    context.font = 'italic 14px STIX Two Text, serif'
    context.textAlign = 'left'
    context.fillText(fitLabel(['Target and draws', 'Target'], available, measure), densityLeft, 22)
    context.fillStyle = MUTED
    context.font = '11px JetBrains Mono, monospace'
    const subtitle = fitLabel(['π(x) · empirical · proposal (scaled)', 'π(x) · draws', 'π(x)', ''], available, measure)
    context.fillText(subtitle, densityLeft, 36)
  }

  function drawTracePanel() {
    const { plotBottom, traceLeft, traceRight, yAt } = panels()
    const width = traceRight - traceLeft

    context.strokeStyle = RULE
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(traceLeft, plotBottom)
    context.lineTo(traceRight, plotBottom)
    context.stroke()

    context.setLineDash([4, 4])
    context.strokeStyle = RULE
    context.beginPath()
    for (const value of [expectation - targetSd, expectation, expectation + targetSd]) {
      context.moveTo(traceLeft, yAt(value))
      context.lineTo(traceRight, yAt(value))
    }
    context.stroke()
    context.setLineDash([])

    const start = Math.max(0, draws.length - TRACE_WINDOW)
    const span = Math.max(TRACE_WINDOW, 1)
    context.strokeStyle = OBSERVED
    context.lineWidth = 1.1
    context.beginPath()
    for (let index = start; index < draws.length; index += 1) {
      const x = traceLeft + ((index - start) / span) * width
      const y = yAt(draws[index] ?? state.value)
      if (index === start) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.stroke()

    const headX = traceLeft + ((draws.length - 1 - start) / span) * width
    if (draws.length > 0) {
      context.fillStyle = OBSERVED
      context.beginPath()
      context.arc(headX, yAt(state.value), 3.2, 0, 2 * Math.PI)
      context.fill()
      /* The most recent proposal, tied to the current state by a rule so
       * that a refused move reads as the jump the chain did not take. */
      if (!lastAccepted) {
        context.strokeStyle = RULE
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(headX, yAt(state.value))
        context.lineTo(headX, yAt(lastProposal))
        context.stroke()
      }
      context.strokeStyle = lastAccepted ? OBSERVED : MUTED
      context.lineWidth = 1.2
      context.beginPath()
      context.arc(headX, yAt(lastProposal), 4.6, 0, 2 * Math.PI)
      context.stroke()
    }

    context.fillStyle = INK
    context.font = 'italic 14px STIX Two Text, serif'
    context.textAlign = 'left'
    context.fillText('Trace', traceLeft, 22)
    context.fillStyle = MUTED
    context.font = '11px JetBrains Mono, monospace'
    const measure = (text: string) => context.measureText(text).width
    context.fillText(
      fitLabel([`most recent ${TRACE_WINDOW} draws`, `last ${TRACE_WINDOW}`, ''], width, measure),
      traceLeft,
      36,
    )
    context.textAlign = 'center'
    context.fillText('draw index', (traceLeft + traceRight) / 2, plotBottom + 19)
  }

  function drawStateAxis() {
    const { plotTop, plotBottom, densityLeft, yAt } = panels()
    context.strokeStyle = RULE
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(densityLeft - 6, plotTop)
    context.lineTo(densityLeft - 6, plotBottom)
    context.stroke()
    context.fillStyle = MUTED
    context.font = '11px JetBrains Mono, monospace'
    context.textAlign = 'right'
    for (const value of [-4, -2, 0, 2, 4]) context.fillText(String(value), densityLeft - 10, yAt(value) + 4)
    context.textAlign = 'left'
    context.fillText('x', 4, plotTop - 10)
  }

  function draw(densities: readonly number[]) {
    context.clearRect(0, 0, cssWidth, cssHeight)
    context.fillStyle = BG
    context.fillRect(0, 0, cssWidth, cssHeight)
    drawStateAxis()
    drawDensityPanel(densities)
    drawTracePanel()
  }

  function redraw() {
    draw(histogramDensity(Array.from(counts), draws.length, binWidth))
  }

  function frame(timestamp: number) {
    if (!running) return
    if (previousFrame === 0) previousFrame = timestamp
    const elapsed = Math.min(0.25, (timestamp - previousFrame) / 1000)
    previousFrame = timestamp
    pendingDraws += elapsed * DRAWS_PER_SECOND
    const steps = Math.floor(pendingDraws)
    pendingDraws -= steps
    advance(steps)
    draw(updateDensityScale(elapsed))
    statsClock += elapsed * 1000
    if (statsClock >= STATS_INTERVAL) {
      statsClock = 0
      emitStats()
    }
    if (draws.length >= total) {
      running = false
      previousFrame = 0
      pendingDraws = 0
      emitStats()
      return
    }
    rafId = requestAnimationFrame(frame)
  }

  function ensureRunning() {
    if (running || suspended || draws.length >= total) return
    running = true
    previousFrame = 0
    rafId = requestAnimationFrame(frame)
  }

  /* A chain is only comparable with itself. Changing the proposal width
   * restarts the run rather than splicing two kernels together, which
   * would leave the accumulated histogram and the diagnostics
   * describing no single Markov chain. */
  function restart() {
    random = seededRandom(seed)
    spareNormal = undefined
    state = { value: CHAIN_START, logDensity: targetLogDensity(CHAIN_START) }
    draws = []
    counts = new Uint32Array(BINS)
    accepted = 0
    runningSum = 0
    lastProposal = CHAIN_START
    lastAccepted = true
    densityScale = MIN_DENSITY_SCALE
    previousFrame = 0
    pendingDraws = 0
    statsClock = 0
    running = false
    cancelAnimationFrame(rafId)
    redraw()
    emitStats()
    ensureRunning()
  }

  function applySize() {
    cssWidth = Math.max(1, canvas.clientWidth)
    cssHeight = Math.max(1, canvas.clientHeight)
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(cssWidth * ratio)
    canvas.height = Math.round(cssHeight * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    redraw()
  }

  const resizeObserver = new ResizeObserver(applySize)
  resizeObserver.observe(canvas)
  applySize()
  emitStats()

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
      pendingDraws = 0
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
      restart()
    },
    setParameters(next) {
      const previous = parameters.proposalSd
      parameters = clampMetropolisHastingsParameters(parameters, next)
      if (parameters.proposalSd !== previous) restart()
      else redraw()
    },
  }
}
