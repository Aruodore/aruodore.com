export type Vec = [number, number]
export type Cov = [number, number, number]
export interface Settings {
  angle: number
  uncertainty: number
  noise: number
  inspect: number
  seed: number
}
export const DT = 0.05
export const STEPS = 240
// Open with one visible oscillation, then continue as new measurements arrive.
export const OPENING_STEP = 80
export const DEFAULT_SETTINGS: Settings = { angle: 1.5, uncertainty: 0.35, noise: 0.08, inspect: 1, seed: 42 }
const GRAVITY = 4
const ANGLE_NOISE = 0.002
const VELOCITY_NOISE = 0.015
export interface Belief {
  mean: Vec
  cov: Cov
}
export interface Step {
  time: number
  truth: Vec
  observation: number
  predicted: Belief
  filtered: Belief
  linear: Belief
}

// Velocity-first Euler keeps the deterministic pendulum bounded at this step size.
export function transition([theta, omega]: Vec, linear = false): Vec {
  const velocity = omega - GRAVITY * DT * (linear ? theta : Math.sin(theta))
  return [theta + DT * velocity, velocity]
}

export function predict({ mean, cov: [a, b, c] }: Belief, linear = false): Belief {
  const slope = linear ? 1 : Math.cos(mean[0])
  const u = 1 - GRAVITY * DT * DT * slope
  const v = -GRAVITY * DT * slope
  // F P F^T + Q, storing only the symmetric entries (00, 01, 11).
  return {
    mean: transition(mean, linear),
    cov: [
      u * u * a + 2 * u * DT * b + DT * DT * c + ANGLE_NOISE ** 2,
      u * v * a + (u + DT * v) * b + DT * c,
      v * v * a + 2 * v * b + c + VELOCITY_NOISE ** 2,
    ],
  }
}

export function correct({ mean, cov: [a, b, c] }: Belief, z: number, noise: number, linear = false): Belief {
  const h = linear ? 1 : Math.cos(mean[0])
  const variance = h * h * a + noise * noise
  const k0 = (a * h) / variance
  const k1 = (b * h) / variance
  const innovation = z - (linear ? mean[0] : Math.sin(mean[0]))
  const u = 1 - k0 * h
  const v = -k1 * h
  // Joseph form: (I-KH) P (I-KH)^T + K R K^T.
  return {
    mean: [mean[0] + k0 * innovation, mean[1] + k1 * innovation],
    cov: [
      u * u * a + k0 * k0 * noise * noise,
      u * (v * a + b) + k0 * k1 * noise * noise,
      v * v * a + 2 * v * b + c + k1 * k1 * noise * noise,
    ],
  }
}

export function createRecord(settings: Settings = DEFAULT_SETTINGS): Step[] {
  let seed = settings.seed >>> 0
  const uniform = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    return (seed + 0.5) / 4294967296
  }
  // Box-Muller gives independent standard normals from paired uniform draws.
  const normal = () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform())
  let truth: Vec = [settings.angle, 0]
  let filtered: Belief = { mean: [settings.angle + 0.25, 0], cov: [settings.uncertainty ** 2, 0, 0.3 ** 2] }
  let linear: Belief = { mean: [...filtered.mean], cov: [...filtered.cov] }
  return Array.from({ length: STEPS }, (_, i) => {
    const next = transition(truth)
    truth = [next[0] + ANGLE_NOISE * normal(), next[1] + VELOCITY_NOISE * normal()]
    const observation = Math.sin(truth[0]) + settings.noise * normal()
    const predicted = predict(filtered)
    filtered = correct(predicted, observation, settings.noise)
    linear = correct(predict(linear, true), observation, settings.noise, true)
    return { time: (i + 1) * DT, truth, observation, predicted, filtered, linear }
  })
}

export function rmse(record: Step[], key: 'filtered' | 'linear'): number {
  return Math.sqrt(record.reduce((sum, step) => sum + (step[key].mean[0] - step.truth[0]) ** 2, 0) / record.length)
}
