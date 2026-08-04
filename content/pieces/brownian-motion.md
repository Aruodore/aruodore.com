---
title: Brownian Motion
slug: brownian-motion
published: 2026-05-23
modified: 2026-08-01
version: 1.0.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/brownian-motion
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'Brownian Motion Simulation: Paths, Variance, and the Heat Equation'
summary: One hundred thousand independent Brownian particles spreading from a common origin, with one path traced through the evolving three-dimensional distribution.
learning_objectives:
  - Distinguish a single realised path from an ensemble distribution at a fixed time.
  - Relate Brownian variance and root-mean-square displacement to elapsed time.
  - Connect the transition density of Brownian motion to the heat equation.
limitations:
  - The display samples a mathematical Brownian-motion model, not the molecular dynamics of a physical fluid.
  - A finite particle cloud only approximates the theoretical Gaussian distribution.
  - The continuous path between displayed timesteps is not rendered.
  - Floating-point arithmetic and a pseudorandom number generator replace ideal real-valued randomness.
math_topics:
  - Brownian motion
  - Wiener process
  - stochastic differential equations
  - heat equation
techniques:
  - Three.js
  - WebGL
  - Box–Muller transform
  - point cloud rendering
references:
  - kind: paper
    author: Einstein, A.
    title: Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen
    year: 1905
    venue: Annalen der Physik
    url: https://onlinelibrary.wiley.com/doi/10.1002/andp.19053220806
  - kind: book
    author: Mörters, P. and Peres, Y.
    title: Brownian Motion
    year: 2010
    venue: Cambridge University Press
  - kind: book
    author: Karatzas, I. and Shreve, S.
    title: Brownian Motion and Stochastic Calculus
    year: 1991
    venue: Springer
  - kind: paper
    author: Black, F. and Scholes, M.
    title: The Pricing of Options and Corporate Liabilities
    year: 1973
    venue: Journal of Political Economy
    url: https://doi.org/10.1086/260062
  - kind: paper
    author: Song, Y. et al.
    title: Score-Based Generative Modeling through Stochastic Differential Equations
    year: 2021
    venue: International Conference on Learning Representations
    url: https://arxiv.org/abs/2011.13456
preview_image: /pieces/brownian-motion/preview.png
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/aruodore/pieces/brownian-motion/simulation.ts
downloads:
  - label: Brownian motion figure
    url: /pieces/brownian-motion/preview.png
    format: PNG
    description: Static fallback and slide-ready figure
  - label: Artifact notes
    url: /pieces/brownian-motion/readme.md
    format: Markdown
    description: Figure and implementation notes
---

::brownian-motion
::

## What is this?

The navy cloud shows the current positions of one hundred thousand independent Brownian particles in three dimensions. Every particle starts at the origin and receives an independent Gaussian displacement at each simulation step. The particles do not interact.

The orange line records one particle's path. It is irregular even at short times because Brownian motion has no smooth velocity. The faint sphere marks the theoretical root-mean-square distance from the origin at the current time. It is a reference surface, not a boundary, so many particles lie on either side of it.

The cloud and the line show two different views of the same process. The line is one realised path through time. The cloud is an empirical approximation to the distribution of $X_t$ at one time across many independent realisations.

## What is the math?

Each particle's position $X_t \in \mathbb{R}^3$ evolves under the stochastic differential equation

$$
dX_t = \sigma \, dW_t,
$$

where $W_t$ is a standard three-dimensional Wiener process and $\sigma>0$ is the noise amplitude. The three coordinates of $W_t$ are independent one-dimensional Brownian motions.

The transition density from the origin at time $t$ is the isotropic 3D Gaussian

$$
p(\mathbf{x}, t) = \frac{1}{(2\pi\sigma^{2} t)^{3/2}} \exp\!\left(-\frac{\lVert \mathbf{x} \rVert^{2}}{2\sigma^{2} t}\right),
$$

a Gaussian centred at the origin with variance $\sigma^2t$ in each coordinate. The standard deviation along any coordinate is therefore $\sigma\sqrt{t}$. In three dimensions,

$$
\sqrt{\mathbb E\!\left[\lVert X_t\rVert^2\right]}
= \sigma\sqrt{3t}.
$$

This is the radius of the reference sphere in the illustration. It grows in proportion to $\sqrt{t}$ rather than $t$.

The same density $p(\mathbf{x}, t)$ satisfies the heat equation

$$
\frac{\partial p}{\partial t} = \frac{\sigma^{2}}{2} \, \Delta p,
$$

where $\Delta$ is the three-dimensional Laplacian. In this convention the diffusion coefficient is $D=\sigma^2/2$; $\sigma$ itself is the noise amplitude. The equation is also the heat equation in a uniform medium. This correspondence connects the random motion of individual paths to the deterministic evolution of their probability density (Mörters and Peres 2010; Karatzas and Shreve 1991).

Einstein's 1905 analysis related the mean-squared displacement of suspended particles to a diffusion coefficient, providing a statistical account of the observed motion (Einstein 1905). The simulation uses the mathematical Brownian-motion model rather than a molecular model of the surrounding fluid.

## Why is it interesting?

Brownian motion gives a direct link between a stochastic process and a partial differential equation. Simulating many independent paths produces the same Gaussian density that the heat equation predicts. The agreement is visible here: the empirical cloud expands at the rate determined by $\sigma^2t$.

The process also appears as one component of larger models. In geometric Brownian motion, Brownian noise acts on the logarithm of a positive quantity; this is the price model used in the Black and Scholes derivation (Black and Scholes 1973). In score-based generative modelling, a forward SDE gradually perturbs a data distribution and a learned reverse-time process removes that perturbation. The constant-noise, zero-drift process shown here is one simple member of that broader SDE framework, not a description of every diffusion model (Song et al. 2021).

These extensions matter because Brownian motion is mathematically tractable. Its increments are independent and Gaussian, its transition density is explicit, and that density solves a familiar PDE. Those properties make it a useful baseline even when an application requires drift, state-dependent noise, constraints, or non-Gaussian jumps.

## How was it built?

For a timestep $\Delta t$, the simulation applies

$$
X_{n+1}=X_n+\sigma\sqrt{\Delta t}\,Z_n,
\qquad Z_n\sim\mathcal N(0,I_3).
$$

The factor $\sqrt{\Delta t}$ gives each coordinate an increment variance of $\sigma^2\Delta t$. After $n$ steps, the elapsed time is $t=n\Delta t$ and the accumulated variance is $\sigma^2t$.

Three.js renders all particle positions as one `THREE.Points` object backed by a `Float32Array` of length $3N$. The coordinates are updated on the CPU and uploaded through a dynamic `BufferAttribute`. Standard normal samples come from the Box–Muller transform, with the second value from each generated pair cached for the next call.

The orange line stores successive positions of the first particle in a fixed-size buffer. The sphere is a wireframe mesh scaled each frame to $\sigma\sqrt{3t}$. Both are derived from the same particle state and elapsed simulation time as the navy cloud. Resetting clears the positions, the recorded path, the sphere, and the clock.

## Questions to try

1. At a fixed time, is the orange path itself distributed like the navy cloud, or does the cloud describe the endpoints of many paths?
2. If the noise amplitude $\sigma$ were doubled, by what factor would the coordinate variance and RMS radius change?
3. Why do some particles lie outside the RMS shell even though the shell is computed from the theoretical distribution?

## Assumptions and limitations

This is an ensemble visualization of an ideal mathematical process. The particles are independent, start at the origin, have constant noise amplitude, and move in unbounded three-dimensional space. The finite cloud has sampling variation and the renderer shows positions only at discrete times. It does not model collisions, inertia, hydrodynamic interactions, boundaries, measurement error, or the molecular structure of a fluid.
