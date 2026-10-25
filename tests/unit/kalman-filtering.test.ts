import { describe, expect, it } from 'vitest'
import {
  advanceTracker,
  CHI2_95_DF2,
  clampKalmanParameters,
  createSeededRandom,
  createTracker,
  DEFAULT_PARAMETERS,
  DT,
  FIGURE_SEED,
  initialState,
  isOccluded,
  KALMAN_LIMITS,
  measurementCovariance,
  OCCLUDER,
  OPENING_STEP,
  positionEllipse,
  predict,
  processCovariance,
  runTracker,
  standardNormal,
  transitionMatrix,
  trackerStats,
  truePosition,
  update,
  WORLD,
} from '../../pieces/kalman-filtering/model'

const at = (matrix: Float64Array, row: number, column: number, columns = 4) => matrix[row * columns + column]!

describe('kalman filtering model', () => {
  it('builds the constant-velocity transition and white-noise acceleration covariance', () => {
    const F = transitionMatrix(0.5)
    expect(at(F, 0, 2)).toBe(0.5)
    expect(at(F, 1, 3)).toBe(0.5)
    expect(at(F, 2, 2)).toBe(1)
    expect(at(F, 0, 1)).toBe(0)

    const Q = processCovariance(2, 0.5)
    expect(at(Q, 0, 0)).toBeCloseTo((4 * 0.125) / 3)
    expect(at(Q, 0, 2)).toBeCloseTo((4 * 0.25) / 2)
    expect(at(Q, 2, 0)).toBe(at(Q, 0, 2))
    expect(at(Q, 3, 3)).toBeCloseTo(4 * 0.5)
    expect(at(Q, 0, 1)).toBe(0)
  })

  it('shapes measurement noise so y is twice as noisy as x', () => {
    const R = measurementCovariance(0.3)
    expect(at(R, 0, 0, 2)).toBeCloseTo(0.09)
    expect(at(R, 1, 1, 2)).toBeCloseTo(0.36)
    expect(at(R, 0, 1, 2)).toBe(0)
  })

  it('predicts by advancing position and inflating the covariance', () => {
    const state = { mean: Float64Array.of(1, 2, 3, -4), covariance: initialState({ x: 1, y: 2 }, 0.2).covariance }
    const next = predict(state, 0.5)
    expect(Array.from(next.mean)).toEqual([1 + 3 * DT, 2 - 4 * DT, 3, -4])
    expect(at(next.covariance, 0, 0)).toBeGreaterThan(at(state.covariance, 0, 0))
    expect(at(next.covariance, 0, 2)).toBeGreaterThan(0)
  })

  it('matches the scalar Bayes update when position and velocity are uncorrelated', () => {
    const prior = { mean: Float64Array.of(1, 2, 0, 0), covariance: initialState({ x: 1, y: 2 }, 0.5).covariance }
    prior.covariance[0] = 0.64
    const r = 0.3
    const result = update(prior, { x: 1.6, y: 2 }, r)
    const gain = 0.64 / (0.64 + r * r)
    expect(at(result.gain, 0, 0, 2)).toBeCloseTo(gain)
    expect(result.state.mean[0]).toBeCloseTo(1 + gain * 0.6)
    expect(at(result.state.covariance, 0, 0)).toBeCloseTo((1 - gain) * 0.64)
    expect(result.nis).toBeCloseTo((0.6 * 0.6) / (0.64 + r * r))
    expect(Array.from(result.innovation)).toEqual([expect.closeTo(0.6), expect.closeTo(0)])
  })

  it('corrects velocity from a position measurement through their correlation', () => {
    const state = { mean: Float64Array.of(0, 0, 0, 0), covariance: initialState({ x: 0, y: 0 }, 0.3).covariance }
    const predicted = predict(state, 0.5)
    const result = update(predicted, { x: 0.5, y: 0 }, 0.3)
    expect(result.state.mean[2]).toBeGreaterThan(0)
    expect(result.state.mean[3]!).toBeCloseTo(0)
  })

  it('keeps the posterior covariance symmetric and positive semidefinite', () => {
    const { tracker } = runTracker(200, DEFAULT_PARAMETERS, FIGURE_SEED)
    const P = tracker.posterior!.covariance
    for (let i = 0; i < 4; i += 1) {
      expect(at(P, i, i)).toBeGreaterThan(0)
      for (let j = 0; j < 4; j += 1) expect(at(P, i, j)).toBeCloseTo(at(P, j, i), 12)
    }
    for (const [i, j] of [
      [0, 2],
      [1, 3],
      [0, 1],
    ] as const) {
      expect(at(P, i, j) ** 2).toBeLessThanOrEqual(at(P, i, i) * at(P, j, j))
    }
  })

  it('computes the 95% position ellipse from the covariance eigensystem', () => {
    const covariance = new Float64Array(16)
    covariance[0] = 4
    covariance[5] = 1
    const aligned = positionEllipse({ mean: Float64Array.of(3, 4, 0, 0), covariance })
    expect(aligned.cx).toBe(3)
    expect(aligned.cy).toBe(4)
    expect(aligned.semiMajor).toBeCloseTo(Math.sqrt(CHI2_95_DF2 * 4))
    expect(aligned.semiMinor).toBeCloseTo(Math.sqrt(CHI2_95_DF2))
    expect(aligned.angle).toBeCloseTo(0)
    expect(CHI2_95_DF2).toBeCloseTo(5.991, 3)

    covariance[0] = 1
    covariance[5] = 4
    expect(positionEllipse({ mean: new Float64Array(4), covariance }).angle).toBeCloseTo(Math.PI / 2)

    covariance[0] = 2.5
    covariance[5] = 2.5
    covariance[1] = covariance[4] = 1.5
    const tilted = positionEllipse({ mean: new Float64Array(4), covariance })
    expect(tilted.angle).toBeCloseTo(Math.PI / 4)
    expect(tilted.semiMajor ** 2 / CHI2_95_DF2).toBeCloseTo(4)
    expect(tilted.semiMinor ** 2 / CHI2_95_DF2).toBeCloseTo(1)
  })

  it('clamps parameters and keeps unspecified ones', () => {
    const current = { processNoise: 0.5, measurementNoise: 0.2 }
    expect(clampKalmanParameters(current, { processNoise: 99 })).toEqual({
      processNoise: KALMAN_LIMITS.processNoise.max,
      measurementNoise: 0.2,
    })
    expect(clampKalmanParameters(current, { measurementNoise: -1 })).toEqual({
      processNoise: 0.5,
      measurementNoise: KALMAN_LIMITS.measurementNoise.min,
    })
    expect(clampKalmanParameters(current, {})).toEqual(current)
  })

  it('draws reproducible, roughly standard normal noise', () => {
    const a = createSeededRandom(7)
    const b = createSeededRandom(7)
    expect(standardNormal(a)).toBe(standardNormal(b))
    const random = createSeededRandom(11)
    const draws = Array.from({ length: 4000 }, () => standardNormal(random))
    const mean = draws.reduce((sum, value) => sum + value, 0) / draws.length
    const variance = draws.reduce((sum, value) => sum + (value - mean) ** 2, 0) / draws.length
    expect(mean).toBeCloseTo(0, 1)
    expect(variance).toBeCloseTo(1, 1)
  })
})

describe('kalman filtering tracker', () => {
  it('keeps the true path inside the world and crossing the occluder', () => {
    const path = Array.from({ length: 2000 }, (_, k) => truePosition(k * DT))
    for (const point of path) {
      expect(point.x).toBeGreaterThan(0)
      expect(point.x).toBeLessThan(WORLD.width)
      expect(point.y).toBeGreaterThan(0)
      expect(point.y).toBeLessThan(WORLD.height)
    }
    expect(path.some(isOccluded)).toBe(true)
    expect(isOccluded({ x: OCCLUDER.min, y: 0 })).toBe(true)
    expect(isOccluded({ x: OCCLUDER.max + 0.01, y: 0 })).toBe(false)
  })

  it('is deterministic for a seed and differs across seeds', () => {
    const a = runTracker(30, DEFAULT_PARAMETERS, 5).history.map((step) => step.measurement?.x)
    const b = runTracker(30, DEFAULT_PARAMETERS, 5).history.map((step) => step.measurement?.x)
    const c = runTracker(30, DEFAULT_PARAMETERS, 6).history.map((step) => step.measurement?.x)
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })

  it('initialises from the first measurement with a broad velocity prior', () => {
    const { history } = runTracker(1, DEFAULT_PARAMETERS, FIGURE_SEED)
    const first = history[0]!
    expect(first.k).toBe(0)
    expect(first.measurement).not.toBeNull()
    expect(first.nis).toBeNull()
    expect(first.posterior.mean[0]).toBe(first.measurement!.x)
    expect(first.posterior.mean[2]).toBe(0)
    expect(at(first.posterior.covariance, 2, 2)).toBeGreaterThan(at(first.posterior.covariance, 0, 0))
  })

  it('coasts on the prediction behind the occluder and grows the ellipse', () => {
    const { history } = runTracker(OPENING_STEP + 1, DEFAULT_PARAMETERS, FIGURE_SEED)
    const hidden = history.filter((step) => step.measurement === null)
    expect(hidden.length).toBeGreaterThan(5)
    for (const step of hidden) {
      expect(isOccluded(step.truth)).toBe(true)
      expect(step.posterior).toBe(step.predicted)
      expect(step.nis).toBeNull()
    }
    const area = (step: (typeof history)[number]) => {
      const e = positionEllipse(step.posterior)
      return e.semiMajor * e.semiMinor
    }
    hidden.forEach((step, i) => {
      const before = hidden[i - 1]
      if (before && before.k === step.k - 1) expect(area(step)).toBeGreaterThan(area(before))
    })
  })

  it('opens on the first measurement after the occluder, with the prior wider than the posterior', () => {
    const { history } = runTracker(OPENING_STEP + 1, DEFAULT_PARAMETERS, FIGURE_SEED)
    const last = history[OPENING_STEP]!
    expect(last.k).toBe(OPENING_STEP)
    expect(last.measurement).not.toBeNull()
    expect(history[OPENING_STEP - 1]!.measurement).toBeNull()
    const prior = positionEllipse(last.predicted)
    const posterior = positionEllipse(last.posterior)
    expect(posterior.semiMajor * posterior.semiMinor).toBeLessThan(0.5 * prior.semiMajor * prior.semiMinor)
  })

  it('draws the same measurement noise whether or not the occluder is on', () => {
    const on = runTracker(120, DEFAULT_PARAMETERS, FIGURE_SEED, true).history
    const off = runTracker(120, DEFAULT_PARAMETERS, FIGURE_SEED, false).history
    expect(off.every((step) => step.measurement !== null)).toBe(true)
    on.forEach((step, k) => {
      if (step.measurement) expect(step.measurement).toEqual(off[k]!.measurement)
    })
  })

  it('never hides the first step', () => {
    const tracker = createTracker(1)
    const step = advanceTracker(tracker, DEFAULT_PARAMETERS, true)
    expect(step.measurement).not.toBeNull()
    expect(tracker.k).toBe(1)
  })

  it('reports zero statistics before any step', () => {
    expect(trackerStats(createTracker(1))).toEqual({ step: 0, filterRmse: 0, measurementRmse: 0, meanNis: 0 })
  })

  it('beats the raw measurements and stays consistent at the default settings', () => {
    const open = trackerStats(runTracker(3000, DEFAULT_PARAMETERS, FIGURE_SEED, false).tracker)
    expect(open.filterRmse).toBeLessThan(0.6 * open.measurementRmse)
    expect(open.meanNis).toBeGreaterThan(1.7)
    expect(open.meanNis).toBeLessThan(2.6)

    const occluded = trackerStats(runTracker(3000, DEFAULT_PARAMETERS, FIGURE_SEED, true).tracker)
    expect(occluded.filterRmse).toBeLessThan(occluded.measurementRmse)
    expect(occluded.filterRmse).toBeGreaterThan(open.filterRmse)
  })

  it('covers the true position about 95% of the time at the default settings', () => {
    const { history } = runTracker(3000, DEFAULT_PARAMETERS, FIGURE_SEED)
    const inside = history.slice(20).filter((step) => {
      const e = positionEllipse(step.posterior)
      const dx = step.truth.x - e.cx
      const dy = step.truth.y - e.cy
      const u = dx * Math.cos(e.angle) + dy * Math.sin(e.angle)
      const v = -dx * Math.sin(e.angle) + dy * Math.cos(e.angle)
      return (u / e.semiMajor) ** 2 + (v / e.semiMinor) ** 2 <= 1
    })
    expect(inside.length / (history.length - 20)).toBeGreaterThan(0.9)
  })

  it('loses calibration when the assumed process noise is far too small', () => {
    const matched = trackerStats(runTracker(3000, DEFAULT_PARAMETERS, FIGURE_SEED, false).tracker)
    const stiff = trackerStats(
      runTracker(3000, { processNoise: KALMAN_LIMITS.processNoise.min, measurementNoise: 0.15 }, FIGURE_SEED, false)
        .tracker,
    )
    expect(stiff.meanNis).toBeGreaterThan(2 * matched.meanNis)
  })
})
