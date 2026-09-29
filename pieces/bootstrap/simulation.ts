/*
 * Animated nonparametric bootstrap for the sample mean.
 *
 * The upper/left panel is the empirical distribution: every orange mark
 * is one observed value with mass 1/n. The current resample is drawn below
 * it, with repeated selections stacked at the same x-coordinate. The
 * lower/right panel accumulates the means of those resamples into a Monte
 * Carlo approximation of the bootstrap sampling distribution.
 */

import {
  bootstrapMeanStandardError,
  clampBootstrapParameters,
  createSeededRandom,
  drawBootstrapSample,
  generateObservedSample,
  mean,
  percentileInterval,
  sampleStandardDeviation,
  type BootstrapParameters,
  type Interval,
} from './model'

export const MAX_BOOTSTRAP_REPLICATES = 2000
const HISTOGRAM_BINS = 30
const BG = '#FAFAF7'
const INK = '#1A1A1A'
const MUTED = '#6B6B66'
const RULE = '#D8D8D2'
const POSTERIOR = '#1E3A5F'
const OBSERVED = '#C77B3C'
const PLOT_PAD = 34
const MOBILE_BREAKPOINT = 620
const MIN_INTERVAL_REPLICATES = 50

export interface BootstrapStats {
  replicates: number
  observedMean: number
  standardError: number
  interval: Interval
  uniqueValues: number
  complete: boolean
}

export interface BootstrapOptions {
  onStatsUpdate?: (stats: BootstrapStats) => void
}

export interface BootstrapHandle {
  destroy: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  regenerate: () => void
  setParameters: (parameters: Partial<BootstrapParameters>) => void
}

function extent(values: readonly number[]): [number, number] {
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY
  for (const value of values) {
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
  }
  return [minimum, maximum]
}

function countUniqueSelections(sample: readonly number[], resample: readonly number[]) {
  const selected = new Set<number>()
  for (const value of resample) {
    const index = sample.indexOf(value)
    if (index >= 0) selected.add(index)
  }
  return selected.size
}

export function mountBootstrap(canvas: HTMLCanvasElement, opts: BootstrapOptions = {}): BootstrapHandle {
  const renderingContext = canvas.getContext('2d')
  if (!renderingContext) throw new Error('Canvas 2D is unavailable')
  const context: CanvasRenderingContext2D = renderingContext

  let parameters: BootstrapParameters = { sampleSize: 24, speed: 12 }
  let dataSeed = 43117
  let bootstrapSeed = 91823
  let random = createSeededRandom(dataSeed)
  let bootstrapRandom = createSeededRandom(bootstrapSeed)
  let sample: number[] = []
  let currentResample: number[] = []
  let replicates: number[] = []
  let running = false
  let raf = 0
  let previous = 0
  let accumulator = 0
  let width = 0
  let height = 0

  function report() {
    const interval =
      replicates.length >= MIN_INTERVAL_REPLICATES
        ? percentileInterval(replicates)
        : { lower: Number.NaN, upper: Number.NaN }
    opts.onStatsUpdate?.({
      replicates: replicates.length,
      observedMean: mean(sample),
      standardError: replicates.length >= 2 ? sampleStandardDeviation(replicates) : bootstrapMeanStandardError(sample),
      interval,
      uniqueValues: countUniqueSelections(sample, currentResample),
      complete: replicates.length >= MAX_BOOTSTRAP_REPLICATES,
    })
  }

  function rebuildSample() {
    random = createSeededRandom(dataSeed)
    bootstrapRandom = createSeededRandom(bootstrapSeed)
    sample = generateObservedSample(parameters.sampleSize, random)
    currentResample = []
    replicates = []
    accumulator = 0
    report()
    draw()
  }

  function reset() {
    bootstrapRandom = createSeededRandom(bootstrapSeed)
    currentResample = []
    replicates = []
    accumulator = 0
    report()
    draw()
  }

  function addReplicate() {
    currentResample = drawBootstrapSample(sample, bootstrapRandom)
    replicates.push(mean(currentResample))
  }

  function line(x1: number, y1: number, x2: number, y2: number, color = RULE, dash: number[] = []) {
    context.save()
    context.strokeStyle = color
    context.lineWidth = 1
    context.setLineDash(dash)
    context.beginPath()
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
    context.stroke()
    context.restore()
  }

  function label(text: string, x: number, y: number, align: CanvasTextAlign = 'left', color = MUTED) {
    context.fillStyle = color
    context.font = `${width < MOBILE_BREAKPOINT ? 14 : 11}px ui-sans-serif, system-ui, sans-serif`
    context.textAlign = align
    context.fillText(text, x, y)
  }

  function map(value: number, domain: [number, number], range: [number, number]) {
    return range[0] + ((value - domain[0]) / (domain[1] - domain[0])) * (range[1] - range[0])
  }

  function drawSamplePanel(x: number, y: number, panelWidth: number, panelHeight: number) {
    const [minimum, maximum] = extent(sample)
    const padding = Math.max(0.12, (maximum - minimum) * 0.08)
    const domain: [number, number] = [minimum - padding, maximum + padding]
    const left = x + PLOT_PAD
    const right = x + panelWidth - 18
    const observedY = y + panelHeight * 0.35
    const resampleY = y + panelHeight * 0.73

    label('OBSERVED SAMPLE', left, y + 18)
    label(`n = ${sample.length}`, right, y + 18, 'right')
    line(left, observedY, right, observedY)
    line(left, resampleY, right, resampleY)

    for (const value of sample) {
      const px = map(value, domain, [left, right])
      context.fillStyle = OBSERVED
      context.beginPath()
      context.arc(px, observedY, 3.4, 0, Math.PI * 2)
      context.fill()
    }

    const observedMean = mean(sample)
    const meanX = map(observedMean, domain, [left, right])
    line(meanX, y + 29, meanX, observedY - 8, OBSERVED, [3, 3])
    label('sample mean', meanX, y + 27, 'center', INK)

    label('ONE RESAMPLE', left, resampleY - 18)
    if (currentResample.length === 0) {
      label('draws with replacement appear here', left, resampleY + 24)
    } else {
      const counts = new Map<number, number>()
      for (const value of currentResample) counts.set(value, (counts.get(value) ?? 0) + 1)
      for (const [value, count] of counts) {
        const px = map(value, domain, [left, right])
        for (let index = 0; index < count; index += 1) {
          context.fillStyle = POSTERIOR
          context.beginPath()
          context.arc(px, resampleY - index * 7, 3.1, 0, Math.PI * 2)
          context.fill()
        }
      }
      const resampleMeanX = map(mean(currentResample), domain, [left, right])
      line(resampleMeanX, resampleY + 8, resampleMeanX, resampleY + 23, POSTERIOR)
    }

    label(minimum.toFixed(1), left, y + panelHeight - 8)
    label(maximum.toFixed(1), right, y + panelHeight - 8, 'right')
  }

  function drawDistributionPanel(x: number, y: number, panelWidth: number, panelHeight: number) {
    const observedMean = mean(sample)
    const standardError = bootstrapMeanStandardError(sample)
    const halfWidth = Math.max(0.08, standardError * 4.2)
    const domain: [number, number] = [observedMean - halfWidth, observedMean + halfWidth]
    const left = x + PLOT_PAD
    const right = x + panelWidth - 18
    const top = y + 32
    const bottom = y + panelHeight - 34
    const counts = new Uint16Array(HISTOGRAM_BINS)

    for (const value of replicates) {
      const position = (value - domain[0]) / (domain[1] - domain[0])
      const bin = Math.max(0, Math.min(HISTOGRAM_BINS - 1, Math.floor(position * HISTOGRAM_BINS)))
      counts[bin] = (counts[bin] ?? 0) + 1
    }
    let maximum = 1
    for (const count of counts) maximum = Math.max(maximum, count)

    label('BOOTSTRAP MEANS', left, y + 18)
    label(`B = ${replicates.length}`, right, y + 18, 'right')
    line(left, bottom, right, bottom)
    const barWidth = (right - left) / HISTOGRAM_BINS
    for (let index = 0; index < counts.length; index += 1) {
      const barHeight = ((counts[index] ?? 0) / maximum) * (bottom - top)
      context.fillStyle = POSTERIOR
      context.fillRect(left + index * barWidth + 0.5, bottom - barHeight, Math.max(1, barWidth - 1), barHeight)
    }

    if (replicates.length >= MIN_INTERVAL_REPLICATES) {
      const interval = percentileInterval(replicates)
      const lower = map(interval.lower, domain, [left, right])
      const upper = map(interval.upper, domain, [left, right])
      context.save()
      context.globalAlpha = 0.12
      context.fillStyle = POSTERIOR
      context.fillRect(lower, top, upper - lower, bottom - top)
      context.restore()
      line(lower, bottom + 12, upper, bottom + 12, POSTERIOR)
      line(lower, bottom + 8, lower, bottom + 16, POSTERIOR)
      line(upper, bottom + 8, upper, bottom + 16, POSTERIOR)
    }

    const meanX = map(observedMean, domain, [left, right])
    line(meanX, top, meanX, bottom, OBSERVED, [4, 4])
    label(domain[0].toFixed(2), left, bottom + 28)
    label(observedMean.toFixed(2), meanX, bottom + 28, 'center', INK)
    label(domain[1].toFixed(2), right, bottom + 28, 'right')
  }

  function draw() {
    context.clearRect(0, 0, width, height)
    context.fillStyle = BG
    context.fillRect(0, 0, width, height)
    context.textBaseline = 'alphabetic'

    if (width < MOBILE_BREAKPOINT) {
      const split = Math.round(height * 0.48)
      drawSamplePanel(0, 0, width, split)
      line(0, split, width, split)
      drawDistributionPanel(0, split, width, height - split)
    } else {
      const split = Math.round(width * 0.42)
      drawSamplePanel(0, 0, split, height)
      line(split, 0, split, height)
      drawDistributionPanel(split, 0, width - split, height)
    }
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
    const elapsed = Math.min(0.1, (timestamp - previous) / 1000)
    previous = timestamp
    accumulator += elapsed * parameters.speed
    let changed = false
    while (accumulator >= 1 && replicates.length < MAX_BOOTSTRAP_REPLICATES) {
      addReplicate()
      accumulator -= 1
      changed = true
    }
    if (changed) {
      report()
      draw()
    }
    if (replicates.length >= MAX_BOOTSTRAP_REPLICATES) {
      running = false
      return
    }
    raf = requestAnimationFrame(frame)
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)
  rebuildSample()
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
      if (!running && replicates.length < MAX_BOOTSTRAP_REPLICATES) {
        running = true
        previous = performance.now()
        raf = requestAnimationFrame(frame)
      }
    },
    reset,
    regenerate: () => {
      dataSeed += 1
      bootstrapSeed += 1
      rebuildSample()
    },
    setParameters: (next) => {
      const previousSize = parameters.sampleSize
      parameters = clampBootstrapParameters(parameters, next)
      if (parameters.sampleSize !== previousSize) rebuildSample()
      else report()
    },
  }
}
