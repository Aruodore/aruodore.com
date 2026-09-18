---
title: Hamiltonian Monte Carlo
slug: hamiltonian-monte-carlo
published: 2026-09-20
modified: 2026-09-20
version: 1.0.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/hamiltonian-monte-carlo
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'Hamiltonian Monte Carlo: Momentum, Geometry, and Long-Distance Proposals'
summary: Hamiltonian dynamics turns gradients into long proposals that travel along a narrow Gaussian ridge without random-walk diffusion.
learning_objectives:
  - Relate a target density to a potential energy and introduce auxiliary momentum.
  - Follow the leapfrog integrator and its reversible, volume-preserving updates.
  - Explain why a Metropolis correction is still required after numerical integration.
  - Diagnose the trade-off between trajectory length, step size, energy error, and acceptance.
limitations:
  - The target is a two-dimensional Gaussian with an analytic gradient and identity mass matrix.
  - The integration length and step size are fixed rather than adapted during warm-up.
  - This illustrates the mechanism, not the automatic tuning or convergence diagnostics used in production HMC.
math_topics:
  - Markov chain Monte Carlo
  - Hamiltonian Monte Carlo
  - symplectic integration
  - Metropolis correction
techniques:
  - Canvas 2D
  - leapfrog integrator
  - seeded pseudorandom generator
references:
  - kind: paper
    author: Duane, S., Kennedy, A., Pendleton, B. and Roweth, D.
    title: Hybrid Monte Carlo
    year: 1987
    venue: Physics Letters B
    volume: '195'
    issue: '2'
    pages: 216-222
  - kind: paper
    author: Neal, R.
    title: MCMC using Hamiltonian dynamics
    year: 2011
    venue: Handbook of Markov Chain Monte Carlo
    pages: 113-162
  - kind: paper
    author: Betancourt, M.
    title: A conceptual introduction to Hamiltonian Monte Carlo
    year: 2017
    venue: arXiv
    doi: 10.48550/arXiv.1701.02434
  - kind: paper
    author: Hoffman, M. and Gelman, A.
    title: The No-U-Turn sampler: adaptively setting path lengths in Hamiltonian Monte Carlo
    year: 2014
    venue: Journal of Machine Learning Research
    volume: '15'
    pages: 1593-1623
preview_image: /pieces/hamiltonian-monte-carlo/preview.svg
social_image: /pieces/hamiltonian-monte-carlo/social-card.png
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/pieces/hamiltonian-monte-carlo/simulation.ts
downloads:
  - label: Hamiltonian Monte Carlo figure
    url: /pieces/hamiltonian-monte-carlo/preview.svg
    format: SVG
    description: Static fallback and slide-ready figure
---

::hamiltonian-monte-carlo
::

## What is this?

The navy contours are a strongly correlated Gaussian target. Rather than proposing a small random displacement, Hamiltonian Monte Carlo (HMC) first draws a momentum, then follows a teal trajectory through an artificial physical system. The orange marks are the states retained after those trajectories are accepted or rejected.

The interaction exposes the two numerical choices. A longer trajectory can cross much more of the ridge before the next draw. A larger leapfrog step makes that trip cheaper, but produces more integration error and eventually lowers acceptance. The useful region is not a universal number: it depends on the target geometry and the mass matrix.

## What is the math?

For a target density $\pi(q)$, HMC defines potential energy $U(q)=-\log\pi(q)$ and adds a Gaussian momentum $p\sim\mathcal N(0,I)$. The resulting Hamiltonian is

$$
H(q,p)=U(q)+K(p), \qquad K(p)=\tfrac12p^\mathsf{T}p.
$$

Hamilton's equations preserve this total energy in continuous time:

$$
\frac{dq}{dt}=p, \qquad \frac{dp}{dt}=-\nabla U(q).
$$

The browser cannot solve those equations exactly, so it uses $L$ leapfrog steps of size $\epsilon$. One step is a half momentum update, a full position update, then another half momentum update:

$$
p_{t+\frac12}=p_t-\frac\epsilon2\nabla U(q_t),\quad q_{t+1}=q_t+\epsilon p_{t+\frac12},\quad p_{t+1}=p_{t+\frac12}-\frac\epsilon2\nabla U(q_{t+1}).
$$

Leapfrog is reversible and volume preserving, but it has finite-step energy error. HMC therefore accepts the proposed endpoint with probability

$$
\alpha=\min\{1,\exp[-H(q',p')+H(q,p)]\}.
$$

## Why is it interesting?

Random-walk chains make progress through a narrow target by diffusion: many small, locally informed moves. Gradients reveal the direction in which the density changes, while momentum lets HMC retain a direction across many such local evaluations. That is why the teal path travels along this diagonal ridge instead of repeatedly bouncing across it.

The advantage is geometric rather than magical. An unsuitable mass matrix, a step size that is too large, or a trajectory that is too short can erase it. Modern implementations adapt those choices during warm-up; NUTS further avoids fixing $L$ by growing a trajectory until it begins to double back (Hoffman and Gelman, 2014).

## How was it built?

The target's quadratic potential and gradient are written as pure functions. Each animated proposal receives fresh seeded Gaussian momentum, runs the leapfrog integrator, and is corrected with an independent uniform draw. The canvas retains recent orange positions and only the current teal trajectory, keeping redraw work bounded.

The static fallback shows the same geometry, and the component pauses while off-screen, while the document is hidden, and for visitors who prefer reduced motion unless they explicitly run it.

## Questions to try

1. Hold $\epsilon$ fixed and increase $L$. When does a longer path begin to revisit the same region?
2. Hold $L$ fixed and increase $\epsilon$. How does the displayed energy error relate to acceptance?
3. Compare this path with the axis-aligned moves in the Gibbs sampler. Which method uses the target's local geometry more directly?

## Assumptions and limitations

This is a deliberately forgiving Gaussian target: its gradient is exact, cheap, and smooth. Real posterior distributions can have constrained parameters, discontinuities, multiple scales, and costly gradients. The identity mass matrix is mismatched to the target's correlation, so the display isolates momentum and leapfrog integration without claiming to be optimally tuned HMC.
