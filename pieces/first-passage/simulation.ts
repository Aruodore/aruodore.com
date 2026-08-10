import { createNormalSampler } from '../brownian-motion/box-muller'
import { clampFirstPassageParameters, firstPassageCdf, firstPassageDensity, type FirstPassageParameters } from './model'

const DEFAULT_PATHS = 180
const DEFAULT_DT = 0.025
const MAX_TIME = 8
const PLAYBACK_SECONDS = 12
const BG = '#FAFAF7'
const INK = '#1A1A1A'
const MUTED = '#6B6B66'
const RULE = '#D8D8D2'
const POSTERIOR = '#1E3A5F'
const OBSERVED = '#C77B3C'
const MARGIN = { top: 30, right: 22, bottom: 24, left: 44 } as const

interface GeneratedPath {
  values: Float32Array
  hitIndex: number
}

export interface FirstPassageStats {
  elapsed: number
  empiricalCdf: number
  theoreticalCdf: number
  crossed: number
  total: number
}

export interface FirstPassageOptions {
  N?: number
  dt?: number
  onStatsUpdate?: (stats: FirstPassageStats) => void
}

export interface FirstPassageHandle {
  destroy: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  regenerate: () => void
  setParameters: (parameters: Partial<FirstPassageParameters>) => void
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

export function mountFirstPassage(canvas: HTMLCanvasElement, opts: FirstPassageOptions = {}): FirstPassageHandle {
  const renderingContext = canvas.getContext('2d')
  if (!renderingContext) throw new Error('Canvas 2D is unavailable')
  const context: CanvasRenderingContext2D = renderingContext

  const N = opts.N ?? DEFAULT_PATHS
  const dt = opts.dt ?? DEFAULT_DT
  const steps = Math.round(MAX_TIME / dt)
  const parameters: FirstPassageParameters = { boundary: 1.25, sigma: 1 }
  let paths: GeneratedPath[] = []
  let seed = 47821
  let elapsed = 0
  let previousFrame = 0
  let running = true
  let rafId = 0
  let cssWidth = 1
  let cssHeight = 1

  function generate() {
    const random = seededRandom(seed)
    const normal = createNormalSampler(random)
    const scale = parameters.sigma * Math.sqrt(dt)
    paths = Array.from({ length: N }, () => {
      const values = new Float32Array(steps + 1)
      let hitIndex = -1
      for (let step = 1; step <= steps; step += 1) {
        values[step] = (values[step - 1] ?? 0) + scale * normal()
        if (hitIndex < 0 && (values[step] ?? 0) >= parameters.boundary) hitIndex = step
      }
      return { values, hitIndex }
    })
  }

  function emitStats() {
    const currentIndex = Math.min(steps, Math.floor(elapsed / dt))
    const crossed = paths.reduce(
      (count, path) => count + (path.hitIndex >= 0 && path.hitIndex <= currentIndex ? 1 : 0),
      0,
    )
    opts.onStatsUpdate?.({
      elapsed,
      empiricalCdf: crossed / N,
      theoreticalCdf: firstPassageCdf(elapsed, parameters.boundary, parameters.sigma),
      crossed,
      total: N,
    })
  }

  function drawAxes(plotBottom: number, rasterTop: number, boundaryY: number) {
    context.strokeStyle = RULE
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(MARGIN.left, plotBottom)
    context.lineTo(cssWidth - MARGIN.right, plotBottom)
    context.moveTo(MARGIN.left, MARGIN.top)
    context.lineTo(MARGIN.left, plotBottom)
    context.moveTo(MARGIN.left, rasterTop)
    context.lineTo(cssWidth - MARGIN.right, rasterTop)
    context.stroke()

    context.fillStyle = MUTED
    context.font = '11px JetBrains Mono, monospace'
    context.textAlign = 'center'
    for (const t of [0, 2, 4, 6, 8]) {
      const x = MARGIN.left + (t / MAX_TIME) * (cssWidth - MARGIN.left - MARGIN.right)
      context.fillText(String(t), x, plotBottom + 17)
    }
    context.textAlign = 'right'
    context.fillText('0', MARGIN.left - 8, plotBottom + 4)
    context.fillStyle = INK
    context.fillText(parameters.boundary.toFixed(1), MARGIN.left - 8, boundaryY + 4)
    context.fillStyle = MUTED
    context.textAlign = 'left'
    context.fillText('first hitting times', MARGIN.left, rasterTop + 17)
  }

  function draw() {
    context.fillStyle = BG
    context.fillRect(0, 0, cssWidth, cssHeight)
    const rasterHeight = Math.max(62, cssHeight * 0.18)
    const plotBottom = cssHeight - rasterHeight - MARGIN.bottom
    const rasterTop = plotBottom + MARGIN.bottom
    const plotWidth = cssWidth - MARGIN.left - MARGIN.right
    const plotHeight = plotBottom - MARGIN.top
    const yMin = -3.25 * parameters.sigma
    const yMax = Math.max(parameters.boundary + 0.35, 2.25 * parameters.sigma)
    const xAt = (index: number) => MARGIN.left + (index / steps) * plotWidth
    const yAt = (value: number) => MARGIN.top + ((yMax - value) / (yMax - yMin)) * plotHeight
    const currentIndex = Math.min(steps, Math.floor(elapsed / dt))

    drawAxes(plotBottom, rasterTop, yAt(parameters.boundary))
    context.save()
    context.beginPath()
    context.rect(MARGIN.left, MARGIN.top, plotWidth, plotHeight)
    context.clip()
    context.strokeStyle = OBSERVED
    context.globalAlpha = 0.13
    context.lineWidth = 0.75
    for (const path of paths) {
      const end = Math.min(currentIndex, path.hitIndex < 0 ? currentIndex : path.hitIndex)
      if (end < 1) continue
      context.beginPath()
      context.moveTo(xAt(0), yAt(0))
      for (let index = 1; index <= end; index += 1) context.lineTo(xAt(index), yAt(path.values[index] ?? 0))
      context.stroke()
    }
    context.globalAlpha = 1
    context.strokeStyle = INK
    context.globalAlpha = 0.55
    context.lineWidth = 1.5
    context.beginPath()
    context.moveTo(MARGIN.left, yAt(parameters.boundary))
    context.lineTo(cssWidth - MARGIN.right, yAt(parameters.boundary))
    context.stroke()
    context.globalAlpha = 1
    context.restore()

    const binCount = 48
    const bins = new Uint16Array(binCount)
    for (const path of paths) {
      if (path.hitIndex < 0 || path.hitIndex > currentIndex) continue
      const bin = Math.min(binCount - 1, Math.floor((path.hitIndex / steps) * binCount))
      bins[bin] = (bins[bin] ?? 0) + 1
    }
    const maxTheoreticalDensity = Math.max(
      ...Array.from({ length: 160 }, (_, i) =>
        firstPassageDensity(((i + 1) / 160) * MAX_TIME, parameters.boundary, parameters.sigma),
      ),
    )
    const rasterBottom = cssHeight - 7
    const rasterPlotTop = rasterTop + 22
    const rasterPlotHeight = Math.max(10, rasterBottom - rasterPlotTop)
    const binWidth = MAX_TIME / binCount
    const maxEmpiricalDensity = Math.max(...bins) / (N * binWidth)
    const densityScale = Math.max(maxTheoreticalDensity, maxEmpiricalDensity, Number.EPSILON)
    context.fillStyle = OBSERVED
    context.globalAlpha = 0.65
    bins.forEach((count, index) => {
      const width = plotWidth / binCount
      const empiricalDensity = count / (N * binWidth)
      const height = (empiricalDensity / densityScale) * rasterPlotHeight
      context.fillRect(MARGIN.left + index * width, rasterBottom - height, Math.max(1, width - 1), height)
    })
    context.globalAlpha = 1
    context.strokeStyle = POSTERIOR
    context.lineWidth = 1.5
    context.beginPath()
    for (let index = 1; index <= 160; index += 1) {
      const t = (index / 160) * MAX_TIME
      const x = MARGIN.left + (t / MAX_TIME) * plotWidth
      const y =
        rasterBottom - (firstPassageDensity(t, parameters.boundary, parameters.sigma) / densityScale) * rasterPlotHeight
      if (index === 1) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.stroke()

    const nowX = MARGIN.left + (elapsed / MAX_TIME) * plotWidth
    context.strokeStyle = INK
    context.globalAlpha = 0.35
    context.beginPath()
    context.moveTo(nowX, MARGIN.top)
    context.lineTo(nowX, plotBottom)
    context.stroke()
    context.globalAlpha = 1
  }

  function frame(timestamp: number) {
    if (!running) return
    if (previousFrame > 0)
      elapsed = Math.min(MAX_TIME, elapsed + ((timestamp - previousFrame) / 1000) * (MAX_TIME / PLAYBACK_SECONDS))
    previousFrame = timestamp
    draw()
    emitStats()
    if (elapsed < MAX_TIME) rafId = requestAnimationFrame(frame)
    else running = false
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
  rafId = requestAnimationFrame(frame)

  return {
    destroy() {
      running = false
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
    },
    pause() {
      if (!running) return
      running = false
      cancelAnimationFrame(rafId)
      previousFrame = 0
    },
    resume() {
      if (running || elapsed >= MAX_TIME) return
      running = true
      previousFrame = 0
      rafId = requestAnimationFrame(frame)
    },
    reset() {
      elapsed = 0
      previousFrame = 0
      draw()
      emitStats()
      if (!running) {
        running = true
        rafId = requestAnimationFrame(frame)
      }
    },
    regenerate() {
      seed += 1
      generate()
      this.reset()
    },
    setParameters(next) {
      Object.assign(parameters, clampFirstPassageParameters(parameters, next))
      generate()
      elapsed = 0
      previousFrame = 0
      draw()
      emitStats()
      if (!running) {
        running = true
        rafId = requestAnimationFrame(frame)
      }
    },
  }
}
