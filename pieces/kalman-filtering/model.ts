/*
 * Kalman filtering of a hidden moving object in two dimensions.
 *
 * The state is x = (p_x, p_y, v_x, v_y): position and velocity. The filter
 * believes the object moves with nearly constant velocity,
 *
 *     x_k = F x_{k-1} + w_k,   w_k ~ N(0, Q),
 *
 * and that each noisy measurement reports the position only,
 *
 *     z_k = H x_k + e_k,       e_k ~ N(0, R),
 *
 * so the velocity is never observed directly. Because both models are
 * linear and Gaussian, the belief about x_k stays Gaussian forever and is
 * summarised by a mean m and a covariance P. One cycle has two steps:
 *
 *     predict   m^- = F m,            P^- = F P F^T + Q          (prior)
 *     update    S = H P^- H^T + R,    K = P^- H^T S^{-1}
 *               m = m^- + K (z - H m^-)
 *               P = (I - K H) P^- (I - K H)^T + K R K^T           (posterior)
 *
 * The update is Bayes' rule for a Gaussian prior and a Gaussian
 * likelihood. The last line is the Joseph form of P = (I - K H) P^-,
 * which stays symmetric and positive semidefinite in floating point.
 */

export const STATE_DIM = 4
export const MEASUREMENT_DIM = 2

/* Seconds between measurements. The animation runs one step per DT of
 * wall-clock time, so one second on screen is one second of the model. */
export const DT = 0.1

export const WORLD = { width: 10, height: 6 } as const

/* The hidden object crosses an occluder: a vertical band in which no
 * measurement is produced. The filter must coast on its prediction. */
export const OCCLUDER = { min: 6, max: 7.6 } as const

/* The standard deviation of the true measurement noise along x. Along y it
 * is MEASUREMENT_ASPECT times larger, like a camera that localises well
 * across the image and poorly in depth. The model never sees these: it only
 * receives the resulting measurements, so a visitor can set the assumed
 * noise away from the truth and watch the filter over- or under-smooth. */
export const TRUE_MEASUREMENT_SD = 0.15
export const MEASUREMENT_ASPECT = 2

/* Standard deviation of the filter's initial belief about each velocity
 * component, in world units per second. Broad on purpose: one measurement
 * says where the object is, and nothing about where it is going. */
export const INITIAL_VELOCITY_SD = 2

export const KALMAN_LIMITS = {
  processNoise: { min: 0.05, max: 2 },
  measurementNoise: { min: 0.05, max: 1 },
} as const

export const DEFAULT_PARAMETERS = { processNoise: 0.5, measurementNoise: 0.15 } as const

/* Shared by the live canvas and the static preview generator so the still
 * is the figure's opening frame. OPENING_STEP is the index of that frame:
 * the first measurement after the object leaves the occluder, where the
 * wide teal prior and the small navy posterior are both on screen. */
export const FIGURE_SEED = 20261025
export const OPENING_STEP = 64

/* The chi-square quantile with two degrees of freedom at probability 0.95.
 * For two degrees of freedom the distribution function is 1 - exp(-q / 2),
 * so the quantile has the closed form -2 log(1 - 0.95). */
export const CHI2_95_DF2 = -2 * Math.log(0.05)

export interface Point {
  x: number
  y: number
}

export interface KalmanParameters {
  processNoise: number
  measurementNoise: number
}

export interface Gaussian {
  mean: Float64Array
  /* Row-major 4 x 4. */
  covariance: Float64Array
}

export interface Ellipse {
  cx: number
  cy: number
  semiMajor: number
  semiMinor: number
  /* Angle of the major axis from the x axis, in radians. */
  angle: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function clampKalmanParameters(current: KalmanParameters, next: Partial<KalmanParameters>): KalmanParameters {
  return {
    processNoise:
      next.processNoise === undefined
        ? current.processNoise
        : clamp(next.processNoise, KALMAN_LIMITS.processNoise.min, KALMAN_LIMITS.processNoise.max),
    measurementNoise:
      next.measurementNoise === undefined
        ? current.measurementNoise
        : clamp(next.measurementNoise, KALMAN_LIMITS.measurementNoise.min, KALMAN_LIMITS.measurementNoise.max),
  }
}

/* The hidden trajectory: two incommensurate sinusoids, so the object keeps
 * accelerating and the constant-velocity model is always slightly wrong.
 * Its peak acceleration is about 0.8 world units per second squared. */
export function truePosition(t: number): Point {
  return { x: 5 + 3.8 * Math.sin(0.45 * t), y: 3 + 1.8 * Math.sin(0.62 * t + 0.6) }
}

export function isOccluded(point: Point): boolean {
  return point.x >= OCCLUDER.min && point.x <= OCCLUDER.max
}

function multiply(A: Float64Array, B: Float64Array, rows: number, inner: number, cols: number): Float64Array {
  const C = new Float64Array(rows * cols)
  for (let i = 0; i < rows; i += 1) {
    for (let k = 0; k < inner; k += 1) {
      const a = A[i * inner + k]!
      for (let j = 0; j < cols; j += 1) C[i * cols + j] = C[i * cols + j]! + a * B[k * cols + j]!
    }
  }
  return C
}

function transpose(A: Float64Array, rows: number, cols: number): Float64Array {
  const T = new Float64Array(rows * cols)
  for (let i = 0; i < rows; i += 1) for (let j = 0; j < cols; j += 1) T[j * rows + i] = A[i * cols + j]!
  return T
}

function add(A: Float64Array, B: Float64Array): Float64Array {
  return Float64Array.from(A, (value, index) => value + B[index]!)
}

/* H picks the position out of the state. */
const H = Float64Array.of(1, 0, 0, 0, 0, 1, 0, 0)

/* F advances position by velocity times dt and leaves velocity unchanged. */
export function transitionMatrix(dt: number): Float64Array {
  const F = new Float64Array(STATE_DIM * STATE_DIM)
  for (let i = 0; i < STATE_DIM; i += 1) F[i * STATE_DIM + i] = 1
  F[0 * STATE_DIM + 2] = dt
  F[1 * STATE_DIM + 3] = dt
  return F
}

/* Discrete white-noise acceleration. If the acceleration is white noise of
 * intensity q (units of speed per square-root second), integrating it over
 * dt gives, per axis, the covariance of (position, velocity):
 *
 *     q^2 [ dt^3 / 3   dt^2 / 2 ]
 *         [ dt^2 / 2   dt       ]
 */
export function processCovariance(q: number, dt: number): Float64Array {
  const Q = new Float64Array(STATE_DIM * STATE_DIM)
  const q2 = q * q
  for (const axis of [0, 1]) {
    const velocity = axis + 2
    Q[axis * STATE_DIM + axis] = (q2 * dt ** 3) / 3
    Q[axis * STATE_DIM + velocity] = (q2 * dt ** 2) / 2
    Q[velocity * STATE_DIM + axis] = (q2 * dt ** 2) / 2
    Q[velocity * STATE_DIM + velocity] = q2 * dt
  }
  return Q
}

/* R = diag(r^2, (aspect r)^2): the filter shares the true noise's shape and
 * differs from the truth only in scale. */
export function measurementCovariance(r: number): Float64Array {
  return Float64Array.of(r * r, 0, 0, (MEASUREMENT_ASPECT * r) ** 2)
}

export function predict(state: Gaussian, processNoise: number, dt = DT): Gaussian {
  const F = transitionMatrix(dt)
  const mean = multiply(F, state.mean, STATE_DIM, STATE_DIM, 1)
  const FP = multiply(F, state.covariance, STATE_DIM, STATE_DIM, STATE_DIM)
  const covariance = add(
    multiply(FP, transpose(F, STATE_DIM, STATE_DIM), STATE_DIM, STATE_DIM, STATE_DIM),
    processCovariance(processNoise, dt),
  )
  return { mean, covariance }
}

export interface UpdateResult {
  state: Gaussian
  /* Kalman gain K (4 x 2, row-major). */
  gain: Float64Array
  /* z - H m^-, the part of the measurement the prediction did not expect. */
  innovation: Float64Array
  /* Normalised innovation squared, y^T S^{-1} y. Under a correct model it
   * has a chi-square distribution with two degrees of freedom, mean 2. */
  nis: number
}

export function update(predicted: Gaussian, z: Point, measurementNoise: number): UpdateResult {
  const { mean, covariance } = predicted
  const R = measurementCovariance(measurementNoise)
  const innovation = Float64Array.of(z.x - mean[0]!, z.y - mean[1]!)

  const PHt = multiply(covariance, transpose(H, MEASUREMENT_DIM, STATE_DIM), STATE_DIM, STATE_DIM, MEASUREMENT_DIM)
  const S = add(multiply(H, PHt, MEASUREMENT_DIM, STATE_DIM, MEASUREMENT_DIM), R)
  const det = S[0]! * S[3]! - S[1]! * S[2]!
  const Sinv = Float64Array.of(S[3]! / det, -S[1]! / det, -S[2]! / det, S[0]! / det)
  const K = multiply(PHt, Sinv, STATE_DIM, MEASUREMENT_DIM, MEASUREMENT_DIM)

  const correction = multiply(K, innovation, STATE_DIM, MEASUREMENT_DIM, 1)
  const posteriorMean = add(mean, correction)

  const IKH = Float64Array.from(multiply(K, H, STATE_DIM, MEASUREMENT_DIM, STATE_DIM), (value, index) =>
    index % (STATE_DIM + 1) === 0 ? 1 - value : -value,
  )
  const joseph = add(
    multiply(
      multiply(IKH, covariance, STATE_DIM, STATE_DIM, STATE_DIM),
      transpose(IKH, STATE_DIM, STATE_DIM),
      STATE_DIM,
      STATE_DIM,
      STATE_DIM,
    ),
    multiply(
      multiply(K, R, STATE_DIM, MEASUREMENT_DIM, MEASUREMENT_DIM),
      transpose(K, STATE_DIM, MEASUREMENT_DIM),
      STATE_DIM,
      MEASUREMENT_DIM,
      STATE_DIM,
    ),
  )
  const posteriorCovariance = Float64Array.from(
    joseph,
    (value, index) => (value + joseph[(index % STATE_DIM) * STATE_DIM + Math.floor(index / STATE_DIM)]!) / 2,
  )

  const nis =
    innovation[0]! * (Sinv[0]! * innovation[0]! + Sinv[1]! * innovation[1]!) +
    innovation[1]! * (Sinv[2]! * innovation[0]! + Sinv[3]! * innovation[1]!)

  return { state: { mean: posteriorMean, covariance: posteriorCovariance }, gain: K, innovation, nis }
}

/* The initial belief: position at the first measurement with the assumed
 * measurement noise, and a broad zero-mean prior on each velocity. */
export function initialState(z: Point, measurementNoise: number): Gaussian {
  const covariance = new Float64Array(STATE_DIM * STATE_DIM)
  covariance[0] = measurementNoise ** 2
  covariance[STATE_DIM + 1] = (MEASUREMENT_ASPECT * measurementNoise) ** 2
  covariance[2 * STATE_DIM + 2] = INITIAL_VELOCITY_SD ** 2
  covariance[3 * STATE_DIM + 3] = INITIAL_VELOCITY_SD ** 2
  return { mean: Float64Array.of(z.x, z.y, 0, 0), covariance }
}

/* The 95% region of the position marginal. With position covariance
 * [[a, b], [b, d]], the eigenvalues are lambda = (a + d) / 2 +/-
 * sqrt(((a - d) / 2)^2 + b^2), and the region where the squared Mahalanobis
 * distance is at most CHI2_95_DF2 is an ellipse with semi-axes
 * sqrt(CHI2_95_DF2 lambda). */
export function positionEllipse(state: Gaussian): Ellipse {
  const a = state.covariance[0]!
  const b = state.covariance[1]!
  const d = state.covariance[STATE_DIM + 1]!
  const centre = (a + d) / 2
  const spread = Math.hypot((a - d) / 2, b)
  return {
    cx: state.mean[0]!,
    cy: state.mean[1]!,
    semiMajor: Math.sqrt(CHI2_95_DF2 * Math.max(0, centre + spread)),
    semiMinor: Math.sqrt(CHI2_95_DF2 * Math.max(0, centre - spread)),
    angle: 0.5 * Math.atan2(2 * b, a - d),
  }
}

export function createSeededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function standardNormal(random: () => number): number {
  const u = Math.max(Number.EPSILON, random())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

export interface TrackerStep {
  k: number
  truth: Point
  /* Null while the object is behind the occluder. */
  measurement: Point | null
  predicted: Gaussian
  posterior: Gaussian
  nis: number | null
}

export interface Tracker {
  random: () => number
  /* Number of steps taken so far; also the index of the next step. */
  k: number
  posterior: Gaussian | null
  filterSquaredError: number
  measurementSquaredError: number
  measurementCount: number
  nisTotal: number
  nisCount: number
}

export function createTracker(seed: number): Tracker {
  return {
    random: createSeededRandom(seed),
    k: 0,
    posterior: null,
    filterSquaredError: 0,
    measurementSquaredError: 0,
    measurementCount: 0,
    nisTotal: 0,
    nisCount: 0,
  }
}

/* One cycle of the world and the filter. Two normals are drawn at every
 * step whether or not the object is occluded, so the noise at step k does
 * not depend on whether the occluder is switched on. The first step is
 * never occluded because the filter needs a measurement to start from. */
export function advanceTracker(tracker: Tracker, parameters: KalmanParameters, occluder: boolean): TrackerStep {
  const k = tracker.k
  const truth = truePosition(k * DT)
  const noiseX = TRUE_MEASUREMENT_SD * standardNormal(tracker.random)
  const noiseY = MEASUREMENT_ASPECT * TRUE_MEASUREMENT_SD * standardNormal(tracker.random)
  const measurement = k > 0 && occluder && isOccluded(truth) ? null : { x: truth.x + noiseX, y: truth.y + noiseY }

  let predicted: Gaussian
  let posterior: Gaussian
  let nis: number | null = null
  if (tracker.posterior === null) {
    predicted = initialState(measurement!, parameters.measurementNoise)
    posterior = predicted
  } else {
    predicted = predict(tracker.posterior, parameters.processNoise)
    if (measurement) {
      const result = update(predicted, measurement, parameters.measurementNoise)
      posterior = result.state
      nis = result.nis
      tracker.nisTotal += nis
      tracker.nisCount += 1
    } else posterior = predicted
  }

  if (measurement) {
    tracker.measurementSquaredError += (measurement.x - truth.x) ** 2 + (measurement.y - truth.y) ** 2
    tracker.measurementCount += 1
  }
  tracker.filterSquaredError += (posterior.mean[0]! - truth.x) ** 2 + (posterior.mean[1]! - truth.y) ** 2
  tracker.posterior = posterior
  tracker.k = k + 1
  return { k, truth, measurement, predicted, posterior, nis }
}

export interface TrackerStats {
  step: number
  filterRmse: number
  measurementRmse: number
  meanNis: number
}

/* Root-mean-square position errors since the last restart. The filter's
 * error counts every step, including those spent behind the occluder. */
export function trackerStats(tracker: Tracker): TrackerStats {
  return {
    step: Math.max(0, tracker.k - 1),
    filterRmse: tracker.k ? Math.sqrt(tracker.filterSquaredError / tracker.k) : 0,
    measurementRmse: tracker.measurementCount
      ? Math.sqrt(tracker.measurementSquaredError / tracker.measurementCount)
      : 0,
    meanNis: tracker.nisCount ? tracker.nisTotal / tracker.nisCount : 0,
  }
}

export function runTracker(
  steps: number,
  parameters: KalmanParameters,
  seed: number,
  occluder = true,
): { tracker: Tracker; history: TrackerStep[] } {
  const tracker = createTracker(seed)
  const history: TrackerStep[] = []
  for (let i = 0; i < steps; i += 1) history.push(advanceTracker(tracker, parameters, occluder))
  return { tracker, history }
}
