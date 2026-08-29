---
title: Brownian Bridge
slug: brownian-bridge
published: 2026-08-29
modified: 2026-08-29
version: 1.0.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/brownian-bridge
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'Brownian Bridge: Gaussian Conditioning and Pinned Paths'
summary: The same Brownian innovations become paths pinned to a chosen endpoint, making Gaussian conditioning visible.
learning_objectives:
  - Construct a Brownian bridge from Brownian motion by removing its terminal innovation.
  - Derive the bridge mean and covariance using Gaussian conditioning.
  - Explain why conditional uncertainty is largest at the midpoint and vanishes at both endpoints.
limitations:
  - The start is fixed at zero and the terminal time is fixed at one.
  - Paths are sampled on a finite grid, so the display is an approximation to a continuous process.
  - The paired panels share innovations for comparison and are therefore not independent experiments.
math_topics:
  - Brownian bridge
  - Gaussian conditioning
  - conditional covariance
  - stochastic processes
techniques:
  - Canvas 2D
  - Gaussian simulation
  - paired random numbers
references:
  - kind: book
    author: Revuz, D. and Yor, M.
    title: Continuous Martingales and Brownian Motion
    year: 1999
    venue: Springer
  - kind: book
    author: Karatzas, I. and Shreve, S.
    title: Brownian Motion and Stochastic Calculus
    year: 1991
    venue: Springer
  - kind: paper
    author: Kolmogorov, A.
    title: Sulla determinazione empirica di una legge di distribuzione
    year: 1933
    venue: Giornale dell'Istituto Italiano degli Attuari
    volume: '4'
    pages: 83-91
preview_image: /pieces/brownian-bridge/preview.svg
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/pieces/brownian-bridge/simulation.ts
downloads:
  - label: Brownian bridge comparison figure
    url: /pieces/brownian-bridge/preview.svg
    format: SVG
    description: Static fallback and slide-ready figure
---

::brownian-bridge
::

## What is this?

The left panel shows ordinary Brownian motion. Its teal paths begin together but are free to finish anywhere. The right panel starts with exactly the same random innovations, then conditions every navy path to reach the orange endpoint at time one. Move that endpoint and the entire conditional ensemble responds.

The pairing matters. A teal path and its navy counterpart are not two unrelated simulations: they share every random increment before conditioning. This makes the transformation legible. Near the start the two look much alike. Near the terminal time the bridge sheds its remaining uncertainty and all paths meet.

## What is the math?

Let $W_t$ be standard Brownian motion on $0\leq t\leq T$. A Brownian bridge from $x_0$ to $x_T$ can be constructed pathwise as

$$
X_t=x_0+\frac{t}{T}(x_T-x_0)+\sigma\left(W_t-\frac{t}{T}W_T\right).
$$

The random term is zero at $t=0$ and $t=T$, so every realization has the required endpoints. The deterministic line supplies the conditional mean,

$$
\mathbb E[X_t\mid X_T=x_T]=x_0+\frac{t}{T}(x_T-x_0).
$$

This is not an ad hoc correction. The vector $(W_{t_1},\ldots,W_{t_n},W_T)$ is jointly Gaussian, and conditioning a Gaussian vector gives another Gaussian vector. Applying the conditional covariance identity yields

$$
\operatorname{Cov}(X_s,X_t\mid X_T)
=\sigma^2\left(\min(s,t)-\frac{st}{T}\right).
$$

In particular,

$$
\operatorname{Var}(X_t\mid X_T)=\sigma^2t\left(1-\frac{t}{T}\right).
$$

The variance is zero at both endpoints and largest at $T/2$. With $T=1$, the reported midpoint standard deviation is $\sigma/2$. Notice that the selected endpoint changes the mean but not the covariance: moving the orange point translates and tilts the ensemble without changing its conditional spread.

## Why is it interesting?

Conditioning is often taught as a density calculation. The bridge shows that it is also a geometric operation on an entire random function. The correction $tW_T/T$ distributes knowledge of the terminal value backward across the path: weakly near the start, completely at the finish.

The covariance is also the source of the Brownian bridge's role in goodness-of-fit testing. After an empirical distribution function is centred by the hypothesised cumulative distribution and scaled by $\sqrt n$, its limiting fluctuation is a Brownian bridge rather than Brownian motion. The empirical process is pinned because every cumulative distribution starts at zero and ends at one. The Kolmogorov–Smirnov statistic consequently depends on the largest absolute excursion of a bridge (Kolmogorov 1933).

Bridges also appear whenever a stochastic trajectory is observed at two times but hidden between them: missing-data reconstruction, diffusion proposals, path-space Monte Carlo, and smoothing all use the same conditional structure.

## How was it built?

Eighteen standard Brownian paths are generated on a grid of 180 time steps using Gaussian increments with variance $1/180$. The teal panel scales those innovations by $\sigma$. For the navy panel, the terminal value of each innovation path is subtracted in the fraction $t/T$, then the straight line to the selected endpoint is added.

The two panels always reuse the same stored innovations. Changing the endpoint or noise redraws a controlled comparison; **New paths** replaces the innovations with a fresh seeded sample. **Replay conditioning** animates the coefficient of the conditioning correction from zero to one, so the right panel moves continuously from ordinary Brownian motion to the pinned process. Canvas rendering is sized to the displayed element and capped at twice the device pixel ratio, keeping lines crisp without allocating unnecessary pixels.

The animation loop runs only during the 1.8-second conditioning transition, then stops completely. Visitors who prefer reduced motion see the fully conditioned state immediately and retain every control.

## Questions to try

1. Move the endpoint while leaving the noise fixed. Which features translate, and which remain unchanged?
2. Increase $\sigma$. Why does the midpoint standard deviation change while the terminal standard deviation stays zero?
3. Compare paired paths near $t=0$ and near $t=1$. Where does knowledge of the endpoint exert the strongest correction?

## Assumptions and limitations

The display fixes $x_0=0$ and $T=1$ to keep attention on the terminal condition. A finite grid cannot show the almost-surely continuous path at every time, only a piecewise-linear approximation through sampled values. The process is Gaussian with constant diffusion scale; bridges of non-Gaussian or state-dependent diffusions generally require different conditioning machinery (Revuz and Yor 1999; Karatzas and Shreve 1991).
