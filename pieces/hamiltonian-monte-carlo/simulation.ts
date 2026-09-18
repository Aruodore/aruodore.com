import {
  acceptanceProbability,
  clampHmcParameters,
  hamiltonian,
  leapfrog,
  type HmcParameters,
  type HmcState,
  type Point,
} from './model'

const INK = '#1A1A1A',
  MUTED = '#6B6B66',
  RULE = '#D8D8D2',
  POSTERIOR = '#1E3A5F',
  OBSERVED = '#C77B3C',
  PRIOR = '#4A7A6A'
const MAX_DRAWS = 3000
export interface HmcStats {
  draws: number
  acceptanceRate: number
  energyError: number
  meanDistance: number
  complete: boolean
}
export interface HmcHandle {
  destroy: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  regenerate: () => void
  setParameters: (parameters: Partial<HmcParameters>) => void
}
export interface HmcOptions {
  onStatsUpdate?: (stats: HmcStats) => void
}

function randomGenerator(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function mountHamiltonianMonteCarlo(canvas: HTMLCanvasElement, options: HmcOptions = {}): HmcHandle {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable')
  let parameters: HmcParameters = { stepSize: 0.16, leapfrogSteps: 16 },
    seed = 20260920,
    random = randomGenerator(seed),
    spare: number | undefined
  let state: HmcState = { position: { x: -2.6, y: -2.2 }, momentum: { x: 0, y: 0 } },
    path: Point[] = [],
    samples: Point[] = []
  let running = false,
    raf = 0,
    previous = 0,
    pending = 0,
    width = 1,
    height = 1,
    lastEnergyError = 0,
    acceptedDraws = 0,
    lastAccepted = true
  const normal = () => {
    if (spare !== undefined) {
      const result = spare
      spare = undefined
      return result
    }
    const radius = Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, random()))),
      angle = 2 * Math.PI * random()
    spare = radius * Math.sin(angle)
    return radius * Math.cos(angle)
  }
  const reset = () => {
    random = randomGenerator(seed)
    spare = undefined
    state = { position: { x: -2.6, y: -2.2 }, momentum: { x: 0, y: 0 } }
    path = []
    samples = []
    lastEnergyError = 0
    acceptedDraws = 0
    lastAccepted = true
    emit()
  }
  const emit = () => {
    options.onStatsUpdate?.({
      draws: samples.length,
      acceptanceRate: samples.length ? acceptedDraws / samples.length : 0,
      energyError: lastEnergyError,
      meanDistance: samples.length
        ? samples.reduce((sum, point) => sum + Math.hypot(point.x, point.y), 0) / samples.length
        : 0,
      complete: samples.length >= MAX_DRAWS,
    })
  }
  const advance = () => {
    if (samples.length >= MAX_DRAWS) return
    const start: HmcState = { position: { ...state.position }, momentum: { x: normal(), y: normal() } }
    const trajectory: Point[] = [{ ...start.position }]
    let partial = start
    for (let i = 0; i < parameters.leapfrogSteps; i++) {
      partial = leapfrog(partial, parameters.stepSize, 1)
      trajectory.push({ ...partial.position })
    }
    const accepted = random() < acceptanceProbability(start, partial)
    lastEnergyError = Math.abs(hamiltonian(partial) - hamiltonian(start))
    lastAccepted = accepted
    if (accepted) acceptedDraws += 1
    state = accepted
      ? { position: partial.position, momentum: partial.momentum }
      : { position: start.position, momentum: start.momentum }
    path = trajectory
    samples.push({ ...state.position })
  }
  const resize = () => {
    const rect = canvas.getBoundingClientRect(),
      ratio = Math.min(devicePixelRatio || 1, 2)
    width = Math.max(1, rect.width)
    height = Math.max(1, rect.height)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
  }
  const map = (point: Point) => ({ x: width * (0.5 + point.x / 7.5), y: height * (0.52 - point.y / 7.5) })
  const draw = () => {
    context.clearRect(0, 0, width, height)
    const cx = width / 2,
      cy = height * 0.52,
      scale = Math.min(width, height) / 7.5
    context.strokeStyle = RULE
    context.beginPath()
    context.moveTo(24, cy)
    context.lineTo(width - 24, cy)
    context.moveTo(cx, 28)
    context.lineTo(cx, height - 28)
    context.stroke()
    context.save()
    context.translate(cx, cy)
    context.rotate(-Math.PI / 4)
    context.strokeStyle = POSTERIOR
    for (const level of [2.5, 1.8, 1.15, 0.55]) {
      context.globalAlpha = 0.28 + level * 0.13
      context.beginPath()
      context.ellipse(0, 0, level * scale * 1.38, level * scale * 0.28, 0, 0, 2 * Math.PI)
      context.stroke()
    }
    context.restore()
    if (samples.length) {
      context.fillStyle = OBSERVED
      context.globalAlpha = 0.42
      for (const point of samples.slice(-280)) {
        const p = map(point)
        context.fillRect(p.x - 1.3, p.y - 1.3, 2.6, 2.6)
      }
    }
    if (path.length) {
      context.strokeStyle = PRIOR
      context.globalAlpha = 1
      context.lineWidth = 1.5
      context.beginPath()
      path.forEach((point, index) => {
        const p = map(point)
        if (index) context.lineTo(p.x, p.y)
        else context.moveTo(p.x, p.y)
      })
      context.stroke()
      const end = map(lastAccepted ? path.at(-1)! : path[0]!)
      context.fillStyle = lastAccepted ? OBSERVED : INK
      context.beginPath()
      context.arc(end.x, end.y, 4, 0, Math.PI * 2)
      context.fill()
      if (!lastAccepted) {
        context.strokeStyle = OBSERVED
        context.lineWidth = 1.4
        context.beginPath()
        context.moveTo(end.x - 4, end.y - 4)
        context.lineTo(end.x + 4, end.y + 4)
        context.moveTo(end.x + 4, end.y - 4)
        context.lineTo(end.x - 4, end.y + 4)
        context.stroke()
      }
    }
    context.fillStyle = INK
    context.font = 'italic 14px STIX Two Text, serif'
    context.fillText('Hamiltonian trajectory', 24, 24)
    context.fillStyle = MUTED
    context.font = '11px JetBrains Mono, monospace'
    context.fillText('navy target contours · teal leapfrog path · orange draws', 24, 40)
    context.textAlign = 'center'
    context.fillText('q₁', cx, height - 10)
    context.save()
    context.translate(13, cy)
    context.rotate(-Math.PI / 2)
    context.fillText('q₂', 0, 0)
    context.restore()
    context.textAlign = 'left'
  }
  const frame = (time: number) => {
    if (!running) return
    const delta = Math.min(60, time - previous || 16)
    previous = time
    pending += delta * 0.06
    while (pending >= 1) {
      advance()
      pending -= 1
    }
    draw()
    emit()
    raf = requestAnimationFrame(frame)
  }
  const observer = new ResizeObserver(() => {
    resize()
    draw()
  })
  observer.observe(canvas)
  resize()
  draw()
  return {
    destroy: () => {
      running = false
      cancelAnimationFrame(raf)
      observer.disconnect()
    },
    pause: () => {
      running = false
      cancelAnimationFrame(raf)
    },
    resume: () => {
      if (!running) {
        running = true
        previous = performance.now()
        raf = requestAnimationFrame(frame)
      }
    },
    reset,
    regenerate: () => {
      seed += 1
      reset()
    },
    setParameters: (next) => {
      parameters = clampHmcParameters(parameters, next)
      reset()
    },
  }
}
