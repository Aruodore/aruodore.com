/*
 * Side-by-side Brownian motion and Brownian bridge paths.
 *
 * Each row begins with the same standard Brownian innovation W. The left
 * panel draws sigma W_t without conditioning. The right subtracts t W_1
 * and adds the selected linear endpoint trend. Because paired paths share
 * their innovations, every visual difference is caused by conditioning.
 */

import {
  bridgeMean,
  bridgeStandardDeviation,
  clampBrownianBridgeParameters,
  conditionBrownianPath,
  type BrownianBridgeParameters,
} from './model'

const PATH_COUNT = 18
const STEPS = 180
const CONDITIONING_DURATION = 1800
const BG = '#FAFAF7'
const INK = '#1A1A1A'
const MUTED = '#6B6B66'
const RULE = '#D8D8D2'
const POSTERIOR = '#1E3A5F'
const OBSERVED = '#C77B3C'
const PRIOR = '#4A7A6A'
const MARGIN = { top: 58, right: 18, bottom: 34, left: 38 } as const

export interface BrownianBridgeStats {
  endpoint: number
  midpointMean: number
  midpointSd: number
}

export interface BrownianBridgeOptions {
  onStatsUpdate?: (stats: BrownianBridgeStats) => void
}

export interface BrownianBridgeHandle {
  destroy: () => void
  regenerate: () => void
  replayConditioning: () => void
  setReducedMotion: (reduced: boolean) => void
  setParameters: (parameters: Partial<BrownianBridgeParameters>) => void
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

function normalPair(random: () => number): [number, number] {
  const radius = Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, random())))
  const angle = 2 * Math.PI * random()
  return [radius * Math.cos(angle), radius * Math.sin(angle)]
}

function makeInnovations(seed: number): number[][] {
  const random = seededRandom(seed)
  return Array.from({ length: PATH_COUNT }, () => {
    const path = new Array<number>(STEPS + 1).fill(0)
    let spare: number | undefined
    for (let index = 1; index <= STEPS; index += 1) {
      let increment: number
      if (spare === undefined) {
        const pair = normalPair(random)
        increment = pair[0]
        spare = pair[1]
      } else {
        increment = spare
        spare = undefined
      }
      path[index] = (path[index - 1] ?? 0) + increment / Math.sqrt(STEPS)
    }
    return path
  })
}

export function mountBrownianBridge(canvas: HTMLCanvasElement, opts: BrownianBridgeOptions = {}): BrownianBridgeHandle {
  const renderingContext = canvas.getContext('2d')
  if (!renderingContext) throw new Error('Canvas 2D is unavailable')
  const context: CanvasRenderingContext2D = renderingContext
  let parameters: BrownianBridgeParameters = { endpoint: 0.8, sigma: 0.9 }
  let seed = 48117
  let innovations = makeInnovations(seed)
  let cssWidth = 1
  let cssHeight = 1
  let destroyed = false
  let reducedMotion = false
  let conditioningProgress = 0
  let animationStarted = 0
  let rafId = 0

  function emitStats() {
    opts.onStatsUpdate?.({
      endpoint: parameters.endpoint,
      midpointMean: bridgeMean(0.5, parameters.endpoint),
      midpointSd: bridgeStandardDeviation(0.5, parameters.sigma),
    })
  }

  function drawPanel(
    left: number,
    right: number,
    title: string,
    color: string,
    paths: readonly (readonly number[])[],
    conditioned: boolean,
    yAt: (value: number) => number,
  ) {
    const bottom = cssHeight - MARGIN.bottom
    const width = right - left
    context.strokeStyle = RULE
    context.lineWidth = 1
    context.beginPath()
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const x = left + fraction * width
      context.moveTo(x, MARGIN.top)
      context.lineTo(x, bottom)
    }
    for (const value of [-2, -1, 0, 1, 2]) {
      context.moveTo(left, yAt(value))
      context.lineTo(right, yAt(value))
    }
    context.stroke()

    context.fillStyle = INK
    context.font = 'italic 15px STIX Two Text, serif'
    context.textAlign = 'left'
    context.fillText(title, left, 24)
    context.fillStyle = MUTED
    context.font = '11px JetBrains Mono, monospace'
    context.fillText(conditioned ? 'given X₁ = b' : 'no terminal condition', left, 42)
    context.textAlign = 'center'
    for (const fraction of [0, 0.5, 1]) context.fillText(fraction.toFixed(1), left + fraction * width, bottom + 18)

    context.strokeStyle = color
    context.lineWidth = 1.15
    context.globalAlpha = 0.42
    for (const path of paths) {
      context.beginPath()
      path.forEach((value, index) => {
        const x = left + (index / STEPS) * width
        const y = yAt(value)
        if (index === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      })
      context.stroke()
    }
    context.globalAlpha = 1

    if (conditioned) {
      context.strokeStyle = POSTERIOR
      context.lineWidth = 1.75
      context.setLineDash([5, 4])
      context.beginPath()
      context.moveTo(left, yAt(0))
      context.lineTo(right, yAt(parameters.endpoint))
      context.stroke()
      context.setLineDash([])
      context.fillStyle = OBSERVED
      context.beginPath()
      context.arc(right, yAt(parameters.endpoint), 4.5, 0, 2 * Math.PI)
      context.fill()
      context.fillStyle = MUTED
      context.font = '11px JetBrains Mono, monospace'
      context.textAlign = 'right'
      context.fillText(`b = ${parameters.endpoint.toFixed(2)}`, right - 7, yAt(parameters.endpoint) - 8)
    }
  }

  function draw() {
    if (destroyed) return
    context.clearRect(0, 0, cssWidth, cssHeight)
    context.fillStyle = BG
    context.fillRect(0, 0, cssWidth, cssHeight)
    const gap = Math.max(26, cssWidth * 0.045)
    const panelWidth = (cssWidth - MARGIN.left - MARGIN.right - gap) / 2
    const leftA = MARGIN.left
    const rightA = leftA + panelWidth
    const leftB = rightA + gap
    const rightB = cssWidth - MARGIN.right
    const verticalRange = Math.max(2.6, Math.abs(parameters.endpoint) + 1.55 * parameters.sigma)
    const plotHeight = cssHeight - MARGIN.top - MARGIN.bottom
    const yAt = (value: number) => MARGIN.top + ((verticalRange - value) / (2 * verticalRange)) * plotHeight
    const unconditional = innovations.map((path) => path.map((value) => parameters.sigma * value))
    /* Interpolate the conditioning identity itself. At lambda=0 the
     * right panel is the same unconditioned process as the left. As
     * lambda approaches one, t W_1 is removed and the selected linear
     * endpoint trend is introduced. */
    const fullyConditioned = innovations.map((path) =>
      conditionBrownianPath(path, parameters.endpoint, parameters.sigma),
    )
    const bridges = innovations.map((path, pathIndex) => {
      const conditioned = fullyConditioned[pathIndex] ?? []
      return path.map((value, index) => {
        const unconditioned = parameters.sigma * value
        return unconditioned + conditioningProgress * ((conditioned[index] ?? unconditioned) - unconditioned)
      })
    })
    drawPanel(leftA, rightA, 'Brownian motion', PRIOR, unconditional, false, yAt)
    drawPanel(leftB, rightB, 'Brownian bridge', POSTERIOR, bridges, true, yAt)
    context.fillStyle = MUTED
    context.font = '11px JetBrains Mono, monospace'
    context.textAlign = 'left'
    context.fillText('x', 8, MARGIN.top - 8)
    context.textAlign = 'center'
    context.fillText('t', cssWidth / 2, cssHeight - 7)
  }

  function resize() {
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cssWidth = Math.max(1, rect.width)
    cssHeight = Math.max(1, rect.height)
    canvas.width = Math.round(cssWidth * dpr)
    canvas.height = Math.round(cssHeight * dpr)
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    draw()
  }

  function animate(timestamp: number) {
    if (destroyed || reducedMotion) return
    if (animationStarted === 0) animationStarted = timestamp
    const elapsed = Math.min(1, (timestamp - animationStarted) / CONDITIONING_DURATION)
    conditioningProgress = 1 - (1 - elapsed) ** 5
    draw()
    if (elapsed < 1) rafId = requestAnimationFrame(animate)
    else rafId = 0
  }

  function replayConditioning() {
    cancelAnimationFrame(rafId)
    animationStarted = 0
    if (reducedMotion) {
      conditioningProgress = 1
      draw()
      return
    }
    conditioningProgress = 0
    draw()
    rafId = requestAnimationFrame(animate)
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()
  emitStats()
  replayConditioning()

  return {
    destroy() {
      destroyed = true
      cancelAnimationFrame(rafId)
      observer.disconnect()
    },
    regenerate() {
      seed += 1
      innovations = makeInnovations(seed)
      replayConditioning()
    },
    replayConditioning,
    setReducedMotion(reduced) {
      reducedMotion = reduced
      if (reduced) {
        cancelAnimationFrame(rafId)
        rafId = 0
        conditioningProgress = 1
        draw()
      }
    },
    setParameters(next) {
      parameters = clampBrownianBridgeParameters(parameters, next)
      conditioningProgress = 1
      emitStats()
      draw()
    },
  }
}
