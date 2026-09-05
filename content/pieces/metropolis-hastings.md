---
title: Metropolis-Hastings
slug: metropolis-hastings
published: 2026-09-05
modified: 2026-09-05
version: 1.0.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/metropolis-hastings
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'Metropolis-Hastings: Acceptance, Autocorrelation, and the Cost of a Step Size'
summary: A random-walk chain fills in a bimodal density it is never given in normalised form, and the proposal width decides how quickly.
learning_objectives:
  - State the Metropolis acceptance probability and explain why a symmetric proposal removes the proposal density from it.
  - Explain why detailed balance makes the target distribution stationary for the chain.
  - Relate proposal width to acceptance rate, autocorrelation, and effective sample size.
  - Recognise how a proposal that is too small can miss a mode entirely and bias the result.
limitations:
  - The target is fixed, one-dimensional, and known in closed form, so the empirical density can be compared against the truth.
  - A single chain is shown, which cannot diagnose the between-chain disagreement that reveals poor mixing.
  - The run is capped at 6000 draws, and no burn-in is discarded.
math_topics:
  - Markov chain Monte Carlo
  - detailed balance
  - Metropolis-Hastings
  - autocorrelation
  - effective sample size
techniques:
  - Canvas 2D
  - random-walk proposal
  - Geyer initial positive sequence
references:
  - kind: paper
    author: Metropolis, N., Rosenbluth, A., Rosenbluth, M., Teller, A. and Teller, E.
    title: Equation of state calculations by fast computing machines
    year: 1953
    venue: The Journal of Chemical Physics
    volume: '21'
    issue: '6'
    pages: 1087-1092
  - kind: paper
    author: Hastings, W.
    title: Monte Carlo sampling methods using Markov chains and their applications
    year: 1970
    venue: Biometrika
    volume: '57'
    issue: '1'
    pages: 97-109
  - kind: paper
    author: Geyer, C.
    title: Practical Markov chain Monte Carlo
    year: 1992
    venue: Statistical Science
    volume: '7'
    issue: '4'
    pages: 473-483
  - kind: paper
    author: Roberts, G., Gelman, A. and Gilks, W.
    title: Weak convergence and optimal scaling of random walk Metropolis algorithms
    year: 1997
    venue: The Annals of Applied Probability
    volume: '7'
    issue: '1'
    pages: 110-120
  - kind: book
    author: Gelman, A., Carlin, J., Stern, H., Dunson, D., Vehtari, A. and Rubin, D.
    title: Bayesian Data Analysis
    year: 2013
    venue: Chapman and Hall/CRC
preview_image: /pieces/metropolis-hastings/preview.png
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/pieces/metropolis-hastings/simulation.ts
downloads:
  - label: Metropolis-Hastings figure
    url: /pieces/metropolis-hastings/preview.svg
    format: SVG
    description: Static fallback and slide-ready figure
---

::metropolis-hastings
::

## What is this?

The navy curve is a fixed bimodal density. The orange bars are not a fit to it: they are a histogram of the states visited by a single Markov chain that is only ever allowed to compare the density at two points. The chain starts far out in the left tail, and the bars fill in the curve as it runs.

The trace on the right records the same draws in order. Flat segments are rejections, where the proposed move was refused and the chain stayed put, so the same value entered the histogram again. The teal bump follows the current state and shows the proposal kernel the next candidate is drawn from. Widen it with the slider and the chain takes longer steps that are accepted less often; narrow it and almost every move is accepted but almost nothing is explored.

## What is the math?

The target is a two-component Gaussian mixture,

$$
\pi(x)=w_1\,\mathcal N(x;\mu_1,\sigma_1^2)+w_2\,\mathcal N(x;\mu_2,\sigma_2^2),
\qquad w_1+w_2=1,
$$

with $w_1 = 0.38$, $\mu_1 = -1.7$, $\sigma_1 = 0.5$ and $w_2 = 0.62$, $\mu_2 = 1.45$, $\sigma_2 = 0.8$.

From the current state $x$, a candidate is drawn from the random-walk proposal $y = x + \sigma Z$ with $Z\sim\mathcal N(0,1)$, and accepted with probability

$$
\alpha(x,y)=\min\left(1,\ \frac{\pi(y)\,q(x\mid y)}{\pi(x)\,q(y\mid x)}\right).
$$

The Gaussian random walk is symmetric, $q(y\mid x)=q(x\mid y)$, so the proposal density cancels and the ratio reduces to the Metropolis form $\alpha(x,y)=\min\{1,\pi(y)/\pi(x)\}$ (Metropolis et al. 1953; Hastings 1970). Only a ratio of target densities is ever needed, so any normalising constant of $\pi$ divides out. This is the property that makes the method usable on posteriors whose normalising constant is an intractable integral.

Writing the transition kernel as $P(x,\mathrm dy)$, the accept-reject rule gives detailed balance,

$$
\pi(x)P(x,\mathrm dy)=\pi(y)P(y,\mathrm dx),
$$

which is the statement that the chain is reversible with respect to $\pi$. Integrating both sides over $x$ shows $\pi$ is stationary: a chain already distributed as $\pi$ stays distributed as $\pi$. Irreducibility and aperiodicity then give the ergodic average

$$
\frac1n\sum_{t=1}^{n}f(X_t)\;\longrightarrow\;\mathbb E_\pi[f(X)]
$$

almost surely, which is what licenses reading the histogram as an estimate of $\pi$.

The draws are not independent. For a stationary chain the variance of the sample mean carries the integrated autocorrelation time $\tau=1+2\sum_{k\ge1}\rho_k$, where $\rho_k$ is the lag-$k$ autocorrelation, and the reported effective sample size is

$$
\text{ESS}=\frac{n}{\tau}.
$$

The sum is truncated using Geyer's initial positive sequence rule, which stops at the first non-positive adjacent pair $\rho_{2m}+\rho_{2m+1}$ (Geyer 1992). ESS is the number of independent draws that would carry the same information about $\mathbb E_\pi[f]$ as the $n$ correlated ones.

## Why is it interesting?

The acceptance rate is the wrong thing to maximise, and the display makes that concrete. At $\sigma = 0.1$ roughly 95% of proposals are accepted and the chain still explores almost nothing: successive states are nearly identical, the lag-1 autocorrelation sits above 0.99, and the effective sample size falls to about 5 per 1000 draws. Widening the proposal lowers acceptance and raises ESS together, until the two effects balance. On this target the largest ESS per 1000 draws, close to 170, occurs near $\sigma = 3$ at an acceptance rate of about 42%; widening further to $\sigma = 4$ drops acceptance to about 35% and buys nothing. Acceptance and information move in opposite directions over most of the slider, which is the point.

The familiar 0.234 figure for the acceptance rate is an asymptotic result for high-dimensional targets with independent, identically distributed components under a specific scaling (Roberts et al. 1997). It is not a rule for a one-dimensional bimodal density, and the optimum measured here is not close to it. What transfers is the shape of the tradeoff, not the number.

The second lesson is about the valley between the modes. Here the two components overlap enough that a moderate proposal crosses regularly, and the crossing is visible in the trace as an abrupt jump between two bands. It is the small proposals that fail: at $\sigma = 0.05$ the chain often never reaches the second mode at all within a full run, so the histogram converges confidently to a distribution that is not the target. Separation makes this worse quickly, since the crossing probability falls off with the density in the valley. A chain can look healthy on every within-mode diagnostic while having the relative weight of the modes badly wrong, which is why single-chain summaries are insufficient in practice and why between-chain comparison from dispersed starting points is standard (Gelman et al. 2013). Watch the chain mean against the target mean: it can sit at the wrong value for a long time without any sign of trouble in the trace.

The third point is the one the algorithm is famous for. Nothing in the accept-reject step requires the normalised density. In Bayesian inference the posterior is known only up to the marginal likelihood, and the ratio $\pi(y)/\pi(x)$ is exactly the object that survives.

## How was it built?

The target, the acceptance rule, and the diagnostics live in `model.ts` as pure functions with no rendering or framework dependencies. One Metropolis move is a pure function of the current state, a standard normal innovation, and an independent uniform, so a run is reproducible from its seed and the step can be tested directly against the acceptance probability. Densities are compared on the log scale, which keeps the ratio finite where the mixture density underflows in the tails.

The simulation module advances the chain at 140 draws per second, accumulating bin counts and the running mean incrementally rather than rescanning the chain. Both panels share one vertical state axis, so the height of a bar and the height of the trace refer to the same coordinate. The proposal bump is drawn at a fixed peak width rather than on the density scale, because its own peak $1/(\sigma\sqrt{2\pi})$ varies over roughly two orders of magnitude across the slider range; it shows the shape and reach of the kernel, not a density comparable with the curve beside it. Diagnostics are recomputed on a 320 ms timer, since the autocorrelation sum costs $O(\text{lag}\times n)$ and does not visibly change between frames.

Moving the proposal slider restarts the chain rather than switching kernels mid-run. Splicing two proposal widths together would leave the accumulated histogram and the reported autocorrelation describing no single Markov chain, and the diagnostics would be uninterpretable. The chain also pauses when the figure leaves the viewport or the document is hidden, and a visitor who has asked for reduced motion sees the static figure with a Run control until they choose otherwise.

## Questions to try

1. Set $\sigma$ near its minimum and watch acceptance, $\rho_1$, and ESS per 1000 draws together. Which of the three is the honest measure of progress?
2. Find the setting that maximises ESS per 1000 draws. What acceptance rate does it correspond to here, and why should that number not be carried over to a different target?
3. Restart with a new seed several times at the smallest proposal width. How often does the chain reach the second mode within a full run, and how wrong is the chain mean when it does not?

## Assumptions and limitations

The target is fixed and known in closed form, which is what makes the comparison between bars and curve possible and is not the situation the method is used in. Only one chain is shown; the standard diagnostics for convergence compare several chains from dispersed starting points, and nothing here substitutes for that. The run is capped at 6000 draws and no burn-in is discarded, so the early states from the left tail remain in the histogram and bias it towards the left mode. The reported ESS uses a truncated autocorrelation sum, which is itself estimated from the same finite, correlated sample and should be read as an approximation (Geyer 1992).
