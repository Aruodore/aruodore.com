/*
 * Metropolis-Hastings sampling of a fixed one-dimensional target.
 *
 * The target is a two-component Gaussian mixture
 *
 *   pi(x) = sum_j w_j N(x; mu_j, sigma_j^2),   sum_j w_j = 1,
 *
 * which is bimodal: the two modes are separated by a region of low
 * density that a local proposal crosses only rarely.
 *
 * Given the current state x and a symmetric random-walk proposal
 * y = x + sigma Z with Z ~ N(0,1), the Metropolis acceptance
 * probability is
 *
 *   alpha(x, y) = min(1, pi(y)/pi(x)).
 *
 * The proposal density cancels because q(y|x) = q(x|y) for a symmetric
 * kernel, so no normalising constant of pi is ever needed. The
 * resulting chain satisfies detailed balance with respect to pi,
 *
 *   pi(x) P(x -> y) = pi(y) P(y -> x),
 *
 * which makes pi stationary. Ergodicity then gives convergence of
 * sample averages to expectations under pi.
 */

export interface MixtureComponent {
  weight: number
  mean: number
  sd: number
}

/* Fixed bimodal target. The weights are unequal and the modes have
 * different scales so that a single proposal width cannot be well
 * matched to both. */
export const TARGET_COMPONENTS: readonly MixtureComponent[] = [
  { weight: 0.38, mean: -1.7, sd: 0.5 },
  { weight: 0.62, mean: 1.45, sd: 0.8 },
]

/* The plotted and binned range. The target holds less than 1e-5 of its
 * mass outside it, so a histogram over these bins is a faithful picture
 * of the whole distribution. */
export const TARGET_DOMAIN = { min: -5, max: 5 } as const

export const METROPOLIS_HASTINGS_LIMITS = {
  proposalSd: { min: 0.05, max: 4 },
} as const

export interface MetropolisHastingsParameters {
  proposalSd: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function clampMetropolisHastingsParameters(
  current: MetropolisHastingsParameters,
  next: Partial<MetropolisHastingsParameters>,
): MetropolisHastingsParameters {
  return {
    proposalSd:
      next.proposalSd === undefined
        ? current.proposalSd
        : clamp(next.proposalSd, METROPOLIS_HASTINGS_LIMITS.proposalSd.min, METROPOLIS_HASTINGS_LIMITS.proposalSd.max),
  }
}

export function normalDensity(x: number, mean: number, sd: number): number {
  const z = (x - mean) / sd
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI))
}

export function targetDensity(x: number, components: readonly MixtureComponent[] = TARGET_COMPONENTS): number {
  let density = 0
  for (const component of components) density += component.weight * normalDensity(x, component.mean, component.sd)
  return density
}

/* Work on the log scale: the acceptance ratio is a difference of log
 * densities, which stays finite where pi(x) underflows to zero. */
export function targetLogDensity(x: number, components: readonly MixtureComponent[] = TARGET_COMPONENTS): number {
  const density = targetDensity(x, components)
  return density > 0 ? Math.log(density) : Number.NEGATIVE_INFINITY
}

/* E[X] = sum_j w_j mu_j for a mixture. */
export function targetMean(components: readonly MixtureComponent[] = TARGET_COMPONENTS): number {
  let mean = 0
  for (const component of components) mean += component.weight * component.mean
  return mean
}

/* E[X^2] = sum_j w_j (mu_j^2 + sigma_j^2), so the mixture variance
 * carries both the within-component spread and the spread of the
 * component means about the mixture mean. */
export function targetStandardDeviation(components: readonly MixtureComponent[] = TARGET_COMPONENTS): number {
  const mean = targetMean(components)
  let secondMoment = 0
  for (const component of components) {
    secondMoment += component.weight * (component.mean * component.mean + component.sd * component.sd)
  }
  return Math.sqrt(Math.max(0, secondMoment - mean * mean))
}

export function acceptanceProbability(logCurrent: number, logProposed: number): number {
  if (!Number.isFinite(logProposed)) return 0
  if (!Number.isFinite(logCurrent)) return 1
  return Math.min(1, Math.exp(logProposed - logCurrent))
}

export interface ChainState {
  value: number
  logDensity: number
}

export interface MetropolisStep extends ChainState {
  proposal: number
  accepted: boolean
}

/* One Metropolis move. `standardNormal` is the proposal innovation Z and
 * `uniform` is the independent U(0,1) draw compared against alpha. Both
 * are supplied by the caller so the step is a pure function and the
 * chain is reproducible from a seed. */
export function metropolisStep(
  state: ChainState,
  standardNormal: number,
  uniform: number,
  proposalSd: number,
  logDensity: (x: number) => number = targetLogDensity,
): MetropolisStep {
  const proposal = state.value + proposalSd * standardNormal
  const proposedLogDensity = logDensity(proposal)
  const accepted = uniform < acceptanceProbability(state.logDensity, proposedLogDensity)
  return accepted
    ? { value: proposal, logDensity: proposedLogDensity, proposal, accepted: true }
    : { value: state.value, logDensity: state.logDensity, proposal, accepted: false }
}

/* Sample autocorrelation at lag k,
 *   rho_k = sum_t (x_t - xbar)(x_{t+k} - xbar) / sum_t (x_t - xbar)^2.
 * A chain that rejects every move is constant, so the denominator is
 * zero and every draw carries the same information: report rho = 1. */
export function autocorrelation(samples: readonly number[], lag: number): number {
  const n = samples.length
  if (lag < 0 || lag >= n) return 0
  let mean = 0
  for (const sample of samples) mean += sample
  mean /= n
  let variance = 0
  let covariance = 0
  for (let t = 0; t < n; t += 1) {
    const centred = (samples[t] ?? 0) - mean
    variance += centred * centred
    if (t + lag < n) covariance += centred * ((samples[t + lag] ?? 0) - mean)
  }
  if (variance <= 0) return 1
  return covariance / variance
}

/* Effective sample size from the integrated autocorrelation time,
 *
 *   tau = 1 + 2 sum_{k>=1} rho_k,   ESS = n / tau.
 *
 * The sum is truncated by Geyer's initial positive sequence rule. For a
 * reversible chain the paired sums
 *
 *   Gamma_m = rho_{2m} + rho_{2m+1},   m = 0, 1, 2, ...
 *
 * are positive, so the first non-positive Gamma_m marks where the
 * estimated correlations have decayed into noise. The pairing starts at
 * lag zero, where rho_0 = 1, and
 *
 *   -1 + 2 sum_{m>=0} Gamma_m = 1 + 2 sum_{k>=1} rho_k = tau. */
export function effectiveSampleSize(samples: readonly number[], maxLag = 200): number {
  const n = samples.length
  if (n < 2) return n
  const limit = Math.min(maxLag, n - 1)
  let pairedSum = 0
  for (let lag = 0; lag + 1 <= limit; lag += 2) {
    const pair = autocorrelation(samples, lag) + autocorrelation(samples, lag + 1)
    if (pair <= 0) break
    pairedSum += pair
  }
  const integratedTime = Math.max(1, -1 + 2 * pairedSum)
  return clamp(n / integratedTime, 1, n)
}

/* Bin index for a value on a uniform grid over [min, max]. Values on or
 * beyond the upper edge fall in the last bin rather than off the grid. */
export function binIndex(value: number, min: number, max: number, bins: number): number {
  if (!Number.isFinite(value) || value < min || value > max) return -1
  const width = (max - min) / bins
  return Math.min(bins - 1, Math.floor((value - min) / width))
}

/* Convert bin counts to a density, so the histogram is directly
 * comparable with pi rather than with a scaled copy of it. */
export function histogramDensity(counts: readonly number[], total: number, binWidth: number): number[] {
  if (total <= 0 || binWidth <= 0) return counts.map(() => 0)
  return counts.map((count) => count / (total * binWidth))
}
