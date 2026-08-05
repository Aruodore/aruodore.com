---
title: Ornstein–Uhlenbeck
slug: ornstein-uhlenbeck
published: 2026-08-01
modified: 2026-08-01
version: 1.0.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/ornstein-uhlenbeck
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'Ornstein–Uhlenbeck Process: Mean Reversion and the Stationary Distribution'
summary: Seventy-five thousand random paths pulled toward equilibrium, showing how mean reversion turns unbounded Brownian diffusion into a stationary Gaussian cloud.
learning_objectives:
  - Explain how linear drift produces mean reversion.
  - Derive the transient mean and variance and identify the stationary Gaussian law.
  - Relate the parameter theta to memory time and autocorrelation.
limitations:
  - Constant parameters imply one stable equilibrium and exponentially decaying memory.
  - Gaussian shocks exclude jumps, heavy tails, and regime changes.
  - A finite cloud only approximates the transition distribution.
  - The visualization shows independent paths at a common time, not one time-series history.
math_topics:
  - Ornstein–Uhlenbeck process
  - mean reversion
  - stochastic differential equations
  - stationary distributions
techniques:
  - Three.js
  - exact transition sampling
  - WebGL
  - point cloud rendering
references:
  - kind: paper
    author: Uhlenbeck, G. E. and Ornstein, L. S.
    title: On the Theory of the Brownian Motion
    year: 1930
    venue: Physical Review
    url: https://doi.org/10.1103/PhysRev.36.823
  - kind: book
    author: Gardiner, C. W.
    title: Handbook of Stochastic Methods
    year: 2009
    venue: Springer
  - kind: book
    author: Gillespie, D. T.
    title: Markov Processes
    year: 1992
    venue: Academic Press
preview_image: /pieces/ornstein-uhlenbeck/preview.png
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/pieces/ornstein-uhlenbeck/simulation.ts
downloads:
  - label: Ornstein–Uhlenbeck figure
    url: /pieces/ornstein-uhlenbeck/preview.png
    format: PNG
    description: Static fallback and slide-ready figure
---

::ornstein-uhlenbeck
::

## What is this?

Seventy-five thousand independent particles follow the same mean-reverting random process. Each begins at the origin. Noise spreads the cloud, while a restoring drift pulls every particle toward the orange equilibrium point. The faint wireframe sphere marks the stationary root-mean-square distance from that point. Unlike Brownian motion, the cloud does not expand without limit: its width approaches a fixed value determined by the balance between noise and mean reversion.

The controls change that balance directly. Increasing $\theta$ strengthens the restoring force and shortens the process's memory. Increasing $\sigma$ strengthens the random shocks. Moving $\mu$ relocates the equilibrium; the existing cloud follows it rather than being reset, making the pull visible.

## What is the math?

Each coordinate of a particle $X_t \in \mathbb{R}^3$ evolves according to

$$
dX_t = -\theta(X_t-\mu)\,dt + \sigma\,dW_t,
$$

where $\theta>0$ is the rate of mean reversion, $\mu$ is the equilibrium, $\sigma>0$ is the noise amplitude, and $W_t$ is a standard Wiener process. When $X_t$ lies above $\mu$, the drift $-\theta(X_t-\mu)$ is negative; below $\mu$, it is positive. Its magnitude grows linearly with displacement.

Solving the equation with an integrating factor gives

$$
X_t = \mu + (X_0-\mu)e^{-\theta t}
      + \sigma\int_0^t e^{-\theta(t-s)}\,dW_s.
$$

The first term after $\mu$ shows how the initial condition is forgotten. The stochastic integral is a weighted history of random shocks: recent shocks matter most, while the influence of a shock $u$ seconds old is reduced by $e^{-\theta u}$.

Because the stochastic integral is Gaussian, the transition distribution is also Gaussian:

$$
X_t\mid X_0=x_0 \sim
\mathcal N\!\left(
\mu+(x_0-\mu)e^{-\theta t},
\frac{\sigma^2}{2\theta}\left(1-e^{-2\theta t}\right)
\right).
$$

The mean approaches $\mu$, while the variance approaches a finite limit,

$$
\operatorname{Var}(X_\infty)=\frac{\sigma^2}{2\theta}.
$$

This limiting Gaussian is the stationary distribution. Once the process is stationary, its autocorrelation at lag $\tau$ is

$$
\operatorname{Corr}(X_t,X_{t+\tau})=e^{-\theta|\tau|}.
$$

The characteristic memory time is therefore $1/\theta$. The live values beside the simulation let the empirical particle variance be compared with the stationary value $\sigma^2/(2\theta)$ as the cloud settles.

## Why is it interesting?

The Ornstein–Uhlenbeck process is the simplest continuous-time model that is Gaussian, Markovian, and mean reverting. In physics it describes the velocity of a Brownian particle subject to friction, and equivalently the position of a noisy particle in a quadratic potential. Sampled at fixed intervals, it becomes an autoregressive AR(1) process, connecting a continuous-time stochastic differential equation to a standard time-series model.

It is useful whenever deviations are temporary rather than cumulative: fluctuating physical systems, residuals around a dynamic baseline, interest-rate models, neuronal membrane potentials, and latent state models. The assumption is also its limitation. A constant $\theta$, $\mu$, and $\sigma$ imply one stable equilibrium, exponentially decaying memory, Gaussian shocks, and no sudden regime changes.

## How was it built?

Three.js renders the particles as one point cloud backed by a dynamic `Float32Array`. The simulation uses the exact finite-time transition

$$
X_{n+1}=\mu+e^{-\theta\Delta t}(X_n-\mu)
+\sigma\sqrt{\frac{1-e^{-2\theta\Delta t}}{2\theta}}\,Z_n,
\qquad Z_n\sim\mathcal N(0,1),
$$

rather than an Euler–Maruyama approximation. This update has the correct conditional mean and variance for any timestep $\Delta t$, so the distribution does not depend on the rendering frame rate. Standard normals are generated with the Box–Muller transform. Every few frames, the same particle loop accumulates the empirical per-coordinate variance shown in the control panel.

The reference shell has radius $\sqrt{3}\,\sigma/\sqrt{2\theta}$: the stationary root-mean-square Euclidean distance from the equilibrium in three dimensions. It is not a hard boundary. Gaussian paths can and do cross it.

## Questions to try

1. Double $\theta$. What should happen to the stationary variance and the memory time?
2. Move $\mu$ without restarting. Which part of the transition mean explains the cloud's subsequent motion?
3. Double $\sigma$. By what factor should the stationary variance change?

## Assumptions and limitations

The model uses constant parameters, Gaussian noise, linear drift, and one equilibrium in unbounded three-dimensional space. These choices rule out jumps, heavy-tailed shocks, nonlinear restoring forces, changing regimes, and multiple equilibria. The point cloud is a finite ensemble approximation. Although the exact transition removes Euler–Maruyama timestep bias for this model, rendering and summary statistics still use finite-precision arithmetic.
