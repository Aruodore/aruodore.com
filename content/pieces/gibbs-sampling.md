---
title: Gibbs Sampling
slug: gibbs-sampling
published: 2026-09-13
modified: 2026-09-13
version: 1.0.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/gibbs-sampling
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'Gibbs Sampling: Conditional Draws, Correlation, and Slow Mixing'
summary: A Gibbs chain moves one coordinate at a time through a correlated Gaussian, showing why exact conditional draws can still mix slowly.
learning_objectives:
  - Derive the full conditional distributions of a correlated bivariate normal target.
  - Explain why systematic Gibbs updates move horizontally and vertically through the joint density.
  - Relate target correlation to lag-one autocorrelation and effective sample size.
  - Distinguish an exact conditional draw from an independent draw from the joint target.
limitations:
  - The target is a centred, standardized bivariate normal whose full conditionals are available in closed form.
  - Coordinates are updated in a fixed order, so random-scan and blocked Gibbs samplers are not compared.
  - One chain is shown, with no burn-in discarded and a finite cap of 5000 sweeps.
  - Effective sample size is estimated from a finite chain and can differ substantially from its long-run value early in a run.
math_topics:
  - Markov chain Monte Carlo
  - Gibbs sampling
  - conditional Gaussian distributions
  - autocorrelation
techniques:
  - Canvas 2D
  - exact conditional sampling
  - Geyer initial positive sequence
references:
  - kind: paper
    author: Geman, S. and Geman, D.
    title: Stochastic relaxation, Gibbs distributions, and the Bayesian restoration of images
    year: 1984
    venue: IEEE Transactions on Pattern Analysis and Machine Intelligence
    volume: PAMI-6
    issue: '6'
    pages: 721-741
    doi: 10.1109/TPAMI.1984.4767596
  - kind: paper
    author: Gelfand, A. and Smith, A.
    title: Sampling-based approaches to calculating marginal densities
    year: 1990
    venue: Journal of the American Statistical Association
    volume: '85'
    issue: '410'
    pages: 398-409
  - kind: paper
    author: Roberts, G. and Sahu, S.
    title: Updating schemes, correlation structure, blocking and parameterization for the Gibbs sampler
    year: 1997
    venue: Journal of the Royal Statistical Society, Series B
    volume: '59'
    issue: '2'
    pages: 291-317
  - kind: book
    author: Gelman, A., Carlin, J., Stern, H., Dunson, D., Vehtari, A. and Rubin, D.
    title: Bayesian Data Analysis
    year: 2013
    venue: Chapman and Hall/CRC
preview_image: /pieces/gibbs-sampling/preview.svg
social_image: /pieces/gibbs-sampling/social-card-v2.png
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/pieces/gibbs-sampling/simulation.ts
downloads:
  - label: Gibbs sampling figure
    url: /pieces/gibbs-sampling/preview.svg
    format: SVG
    description: Static fallback and slide-ready figure
---

::gibbs-sampling
::

## What is this?

The navy ellipses are contours of a bivariate normal target. The orange path shows the 90 most recent Gibbs sweeps. Each sweep consists of two conditional draws: a horizontal move for $x$ while $y$ is fixed, followed by a vertical move for $y$ while the new $x$ is fixed. The dashed teal corner marks the latest pair.

Set the target correlation near zero and the contours become circular. Successive sweeps are then independent. Move the correlation toward $-1$ or $1$ and the target narrows into a diagonal ridge. The conditional draws remain exact, but they become narrow, so the chain needs many horizontal and vertical steps to travel along the ridge.

The diagnostics use whichever coordinate has the smaller estimated effective sample size and compare it with the exact long-run value. At high correlation, one thousand Gibbs sweeps can carry only as much information about a coordinate mean as a few dozen independent draws.

## What is the math?

The target is a centred bivariate normal with unit marginal variances and correlation $\rho$,

$$
\begin{pmatrix}X\\Y\end{pmatrix}
\sim \mathcal N\!\left(
\begin{pmatrix}0\\0\end{pmatrix},
\begin{pmatrix}1&\rho\\\rho&1\end{pmatrix}
\right), \qquad |\rho|<1.
$$

Its joint density is

$$
\pi(x,y)=\frac{1}{2\pi\sqrt{1-\rho^2}}
\exp\!\left[-\frac{x^2-2\rho xy+y^2}{2(1-\rho^2)}\right].
$$

Holding $y$ fixed and completing the square in $x$ gives one full conditional; symmetry gives the other:

$$
X\mid Y=y\sim\mathcal N\!\left(\rho y,1-\rho^2\right),
\qquad
Y\mid X=x\sim\mathcal N\!\left(\rho x,1-\rho^2\right).
$$

A systematic Gibbs sweep therefore requires two independent standard normal innovations:

$$
\begin{aligned}
X_{t+1}&=\rho Y_t+\sqrt{1-\rho^2}\,Z_{x,t},\\
Y_{t+1}&=\rho X_{t+1}+\sqrt{1-\rho^2}\,Z_{y,t}.
\end{aligned}
$$

Substituting one update into the next shows where the slow mixing comes from. At sweep boundaries, either coordinate behaves as an autoregression with coefficient $\rho^2$. Its lag-$k$ autocorrelation is $\rho^{2k}$, so the integrated autocorrelation time is

$$
\tau=1+2\sum_{k=1}^{\infty}\rho^{2k}
=\frac{1+\rho^2}{1-\rho^2}.
$$

The asymptotic effective sample size is consequently

$$
\operatorname{ESS}\approx n\,\frac{1-\rho^2}{1+\rho^2}.
$$

At $\rho=0$, each sweep is an independent joint draw. At $\rho=0.95$, one thousand sweeps are worth only about 51 independent draws for estimating a coordinate mean.

## Why is it interesting?

When the full conditional distributions can be sampled directly, Gibbs sampling needs neither a proposal scale nor an accept-reject step. Geman and Geman (1984) used this structure for image models, and Gelfand and Smith (1990) helped establish it as a general computational method for Bayesian inference.

The absence of rejections says nothing about independence between successive states. When the joint density is strongly correlated, conditioning makes each update distribution narrow. A draw can be exact from its conditional distribution while moving only a short distance through the joint distribution. The traces then retain long runs, the chain explores the target slowly, and Monte Carlo error remains large.

The geometry also explains why parameterization and blocking matter. Rotating to the principal axes would make this Gaussian target independent, while sampling both coordinates as one block would produce independent joint draws. In larger models those transformations may be difficult or expensive, but the principle survives: a sampler works in the coordinates it is given, and posterior geometry decides whether those coordinates are useful (Roberts and Sahu 1997).

## How was it built?

The model module contains the exact conditional update as a pure function of the current state and two supplied Gaussian innovations. The animation uses a seeded generator and Box-Muller normals, so restarting repeats the same chain while changing the seed creates a genuinely new run.

The target contours are analytic ellipses. Their principal-axis variances are $1+|\rho|$ and $1-|\rho|$, with the major axis rotating when the sign of $\rho$ changes. The canvas renders only the recent path and trace windows, while the full coordinate arrays feed the diagnostics.

Effective sample size is estimated with the same initial-positive-sequence rule used in the Metropolis-Hastings piece. The calculation runs on a short timer rather than every frame because its cost grows with both chain length and maximum lag. The exact long-run comparison comes directly from $(1-\rho^2)/(1+\rho^2)$.

## Questions to try

1. Set $\rho$ to zero. Why do the horizontal and vertical moves now produce an independent joint draw after every sweep?
2. Compare $\rho=0.5$ with $\rho=0.9$. How does the visible ridge width predict the change in effective sample size?
3. Switch the sign of $\rho$. Which features rotate, and which diagnostics remain unchanged?

## Assumptions and limitations

The target is Gaussian, centred, and standardized. Its full conditionals are known exactly and are cheap to sample, conditions that do not hold in many complex MCMC models. Coordinates are updated in a fixed order and one state is retained after each complete sweep. No burn-in is discarded, so the deliberately remote starting point affects early diagnostics. Only one chain is shown, and the finite-chain ESS estimate is not a convergence guarantee (Gelman et al. 2013).
