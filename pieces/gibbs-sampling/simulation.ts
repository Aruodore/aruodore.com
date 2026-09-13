import {
  GIBBS_DOMAIN,
  autocorrelation,
  clampGibbsParameters,
  effectiveSampleSize,
  gibbsSweep,
  sampleCorrelation,
  theoreticalEfficiency,
  type GibbsParameters,
  type GibbsState,
} from './model'

const MAX_SWEEPS = 5000
const SWEEPS_PER_SECOND = 90
const TRACE_WINDOW = 360
const PATH_WINDOW = 90
const STATS_INTERVAL = 320
const MAX_AUTOCORRELATION_LAG = 160
const CONTOUR_LEVELS = [0.85, 0.62, 0.4, 0.2, 0.07] as const
const CHAIN_START = -2.7
const BG = '#FAFAF7'
const INK = '#1A1A1A'
const MUTED = '#6B6B66'
const RULE = '#D8D8D2'
const POSTERIOR = '#1E3A5F'
const OBSERVED = '#C77B3C'
const PRIOR = '#4A7A6A'

export interface GibbsStats {
  sweeps: number
  lagOneAutocorrelation: number
  effectiveSampleSize: number
  empiricalCorrelation: number
  theoreticalEfficiency: number
  complete: boolean
}

export interface GibbsOptions {
  maxSweeps?: number
  onStatsUpdate?: (stats: GibbsStats) => void
}

export interface GibbsHandle {
  destroy: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  regenerate: () => void
  setParameters: (parameters: Partial<GibbsParameters>) => void
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

export function mountGibbsSampling(canvas: HTMLCanvasElement, opts: GibbsOptions = {}): GibbsHandle {
  const renderingContext = canvas.getContext('2d')
  if (!renderingContext) throw new Error('Canvas 2D is unavailable')
  const context: CanvasRenderingContext2D = renderingContext
  const total = opts.maxSweeps ?? MAX_SWEEPS
  let parameters: GibbsParameters = { rho: 0.88 }
  let seed = 20260913
  let random = seededRandom(seed)
  let spareNormal: number | undefined
  let state: GibbsState = { x: CHAIN_START, y: CHAIN_START }
  let intermediate: GibbsState = { ...state }
  let intermediates: GibbsState[] = []
  let xs: number[] = []
  let ys: number[] = []
  let cssWidth = 1
  let cssHeight = 1
  let running = false
  let suspended = true
  let rafId = 0
  let previousFrame = 0
  let pendingSweeps = 0
  let statsClock = 0

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

  function emitStats() {
    if (!opts.onStatsUpdate) return
    const essX = effectiveSampleSize(xs, MAX_AUTOCORRELATION_LAG)
    const essY = effectiveSampleSize(ys, MAX_AUTOCORRELATION_LAG)
    opts.onStatsUpdate({
      sweeps: xs.length,
      lagOneAutocorrelation: xs.length > 1 ? Math.max(autocorrelation(xs, 1), autocorrelation(ys, 1)) : 1,
      effectiveSampleSize: Math.min(essX, essY),
      empiricalCorrelation: sampleCorrelation(xs, ys),
      theoreticalEfficiency: theoreticalEfficiency(parameters.rho),
      complete: xs.length >= total,
    })
  }

  function advance(steps: number) {
    for (let index = 0; index < steps && xs.length < total; index += 1) {
      const next = gibbsSweep(state, standardNormal(), standardNormal(), parameters.rho)
      intermediate = next.intermediate
      state = { x: next.x, y: next.y }
      intermediates.push(intermediate)
      xs.push(state.x)
      ys.push(state.y)
    }
  }

  function layout() {
    const compact = cssWidth < 620
    if (compact) {
      const plotSize = Math.min(cssWidth - 54, cssHeight * 0.58)
      return {
        compact,
        plot: { left: 38, top: 42, size: plotSize },
        trace: { left: 38, top: 60 + plotSize, width: cssWidth - 58, height: Math.max(74, cssHeight - plotSize - 88) },
      }
    }
    const plotSize = Math.min(cssHeight - 74, cssWidth * 0.58)
    return {
      compact,
      plot: { left: 42, top: 42, size: plotSize },
      trace: {
        left: 66 + plotSize,
        top: 42,
        width: Math.max(90, cssWidth - plotSize - 86),
        height: cssHeight - 74,
      },
    }
  }

  function mapPlot(value: number, start: number, size: number, invert = false) {
    const unit = (value - GIBBS_DOMAIN.min) / (GIBBS_DOMAIN.max - GIBBS_DOMAIN.min)
    return invert ? start + size * (1 - unit) : start + size * unit
  }

  function drawContours(left: number, top: number, size: number) {
    const rho = parameters.rho
    const angle = rho >= 0 ? Math.PI / 4 : -Math.PI / 4
    const majorSd = Math.sqrt(1 + Math.abs(rho))
    const minorSd = Math.sqrt(1 - Math.abs(rho))
    const centreX = left + size / 2
    const centreY = top + size / 2
    const scale = size / (GIBBS_DOMAIN.max - GIBBS_DOMAIN.min)
    context.save()
    context.translate(centreX, centreY)
    context.rotate(-angle)
    context.strokeStyle = POSTERIOR
    context.lineWidth = 1.15
    for (const level of CONTOUR_LEVELS) {
      const radius = Math.sqrt(-2 * Math.log(level))
      context.globalAlpha = 0.28 + (1 - level) * 0.48
      context.beginPath()
      context.ellipse(0, 0, radius * majorSd * scale, radius * minorSd * scale, 0, 0, 2 * Math.PI)
      context.stroke()
    }
    context.restore()
    context.globalAlpha = 1
  }

  function drawTargetPanel() {
    const { plot } = layout()
    const { left, top, size } = plot
    const xAt = (x: number) => mapPlot(x, left, size)
    const yAt = (y: number) => mapPlot(y, top, size, true)
    context.strokeStyle = RULE
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(xAt(0), top)
    context.lineTo(xAt(0), top + size)
    context.moveTo(left, yAt(0))
    context.lineTo(left + size, yAt(0))
    context.stroke()

    context.save()
    context.beginPath()
    context.rect(left, top, size, size)
    context.clip()
    drawContours(left, top, size)

    const start = Math.max(0, xs.length - PATH_WINDOW)
    context.strokeStyle = OBSERVED
    context.lineWidth = 1.15
    for (let index = start; index < xs.length; index += 1) {
      const previousX = index > 0 ? (xs[index - 1] ?? CHAIN_START) : CHAIN_START
      const previousY = index > 0 ? (ys[index - 1] ?? CHAIN_START) : CHAIN_START
      const midpoint = intermediates[index] ?? { x: xs[index] ?? previousX, y: previousY }
      const age = (index - start + 1) / Math.max(1, xs.length - start)
      context.globalAlpha = 0.1 + 0.5 * age
      context.beginPath()
      context.moveTo(xAt(previousX), yAt(previousY))
      context.lineTo(xAt(midpoint.x), yAt(midpoint.y))
      context.lineTo(xAt(xs[index] ?? midpoint.x), yAt(ys[index] ?? midpoint.y))
      context.stroke()
    }
    context.globalAlpha = 1

    if (xs.length > 0) {
      const previousX = xs.length > 1 ? (xs[xs.length - 2] ?? state.x) : CHAIN_START
      const previousY = xs.length > 1 ? (ys[ys.length - 2] ?? state.y) : CHAIN_START
      context.strokeStyle = PRIOR
      context.setLineDash([5, 4])
      context.lineWidth = 1.5
      context.beginPath()
      context.moveTo(xAt(previousX), yAt(previousY))
      context.lineTo(xAt(intermediate.x), yAt(intermediate.y))
      context.lineTo(xAt(state.x), yAt(state.y))
      context.stroke()
      context.setLineDash([])
      context.fillStyle = OBSERVED
      context.beginPath()
      context.arc(xAt(state.x), yAt(state.y), 3.5, 0, 2 * Math.PI)
      context.fill()
    }
    context.restore()
    context.strokeStyle = RULE
    context.lineWidth = 1
    context.strokeRect(left, top, size, size)

    context.fillStyle = INK
    context.font = 'italic 14px STIX Two Text, serif'
    context.textAlign = 'left'
    context.fillText('Gibbs path', left, 22)
    context.fillStyle = MUTED
    context.font = '11px JetBrains Mono, monospace'
    context.fillText('target contours · one axis at a time', left, 36)
    context.textAlign = 'center'
    context.fillText('x', left + size / 2, top + size + 20)
    context.save()
    context.translate(left - 24, top + size / 2)
    context.rotate(-Math.PI / 2)
    context.fillText('y', 0, 0)
    context.restore()
  }

  function drawTraces() {
    const { trace, compact } = layout()
    const { left, top, width, height } = trace
    const half = compact ? height / 2 : height / 2
    const start = Math.max(0, xs.length - TRACE_WINDOW)
    const xAt = (index: number) => left + ((index - start) / Math.max(1, TRACE_WINDOW - 1)) * width
    const drawOne = (values: readonly number[], panelTop: number, label: string) => {
      const panelHeight = half - 8
      const yAt = (value: number) => mapPlot(value, panelTop, panelHeight, true)
      context.strokeStyle = RULE
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(left, yAt(0))
      context.lineTo(left + width, yAt(0))
      context.stroke()
      context.strokeStyle = OBSERVED
      context.lineWidth = 1.05
      context.beginPath()
      for (let index = start; index < values.length; index += 1) {
        const px = xAt(index)
        const py = yAt(values[index] ?? 0)
        if (index === start) context.moveTo(px, py)
        else context.lineTo(px, py)
      }
      context.stroke()
      context.fillStyle = MUTED
      context.font = 'italic 12px STIX Two Text, serif'
      context.textAlign = 'left'
      context.fillText(label, left + 5, panelTop + 15)
    }
    drawOne(xs, top, 'x')
    drawOne(ys, top + half, 'y')
    context.strokeStyle = RULE
    context.strokeRect(left, top, width, height - 8)
    if (!compact) {
      context.fillStyle = INK
      context.font = 'italic 14px STIX Two Text, serif'
      context.textAlign = 'left'
      context.fillText('Coordinate traces', left, 22)
      context.fillStyle = MUTED
      context.font = '11px JetBrains Mono, monospace'
      context.fillText(`most recent ${TRACE_WINDOW} sweeps`, left, 36)
    }
  }

  function draw() {
    context.fillStyle = BG
    context.fillRect(0, 0, cssWidth, cssHeight)
    drawTargetPanel()
    drawTraces()
  }

  function resize() {
    const rect = canvas.getBoundingClientRect()
    cssWidth = Math.max(1, rect.width)
    cssHeight = Math.max(1, rect.height)
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(cssWidth * ratio)
    canvas.height = Math.round(cssHeight * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    draw()
  }

  function frame(now: number) {
    if (!running) return
    const elapsed = previousFrame === 0 ? 0 : Math.min(0.1, (now - previousFrame) / 1000)
    previousFrame = now
    pendingSweeps += elapsed * SWEEPS_PER_SECOND
    const steps = Math.floor(pendingSweeps)
    pendingSweeps -= steps
    if (steps > 0) advance(steps)
    statsClock += elapsed * 1000
    if (statsClock >= STATS_INTERVAL || xs.length >= total) {
      statsClock = 0
      emitStats()
    }
    draw()
    if (xs.length >= total) {
      running = false
      return
    }
    rafId = requestAnimationFrame(frame)
  }

  function resetState() {
    random = seededRandom(seed)
    spareNormal = undefined
    state = { x: CHAIN_START, y: CHAIN_START }
    intermediate = { ...state }
    intermediates = []
    xs = []
    ys = []
    pendingSweeps = 0
    statsClock = 0
    previousFrame = 0
    emitStats()
    draw()
  }

  function pause() {
    suspended = true
    running = false
    cancelAnimationFrame(rafId)
  }

  function resume() {
    suspended = false
    if (running || xs.length >= total) return
    running = true
    previousFrame = 0
    rafId = requestAnimationFrame(frame)
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)
  resize()

  return {
    destroy() {
      pause()
      resizeObserver.disconnect()
    },
    pause,
    resume,
    reset() {
      resetState()
      if (!suspended) resume()
    },
    regenerate() {
      seed += 1
      resetState()
      if (!suspended) resume()
    },
    setParameters(next) {
      const updated = clampGibbsParameters(parameters, next)
      if (updated.rho === parameters.rho) return
      parameters = updated
      resetState()
      if (!suspended) resume()
    },
  }
}
