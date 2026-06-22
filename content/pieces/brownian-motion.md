---
title: Brownian Motion
slug: brownian-motion
published: 2026-05-23
summary: One hundred thousand independent random walkers in three dimensions, drifting outward according to the same equation that describes pollen grains in water, stock prices, and the forward pass of a diffusion model.
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
preview_image: /pieces/brownian-motion/preview.png
preview_video: /pieces/brownian-motion/preview.mp4
source_url: https://github.com/lucasaruodore/aruodore
---

::BrownianMotion
::

## What is this?

One hundred thousand particles, all started at the origin, each taking an independent Gaussian step in three dimensions at every timestep. The walkers do not interact. What you see is not the trajectory of one process but the visible signature of many — the empirical density of a continuous-time stochastic process, sampled and rendered as a cloud of points. At any fixed moment after the reset, the cloud's shape is an isotropic three-dimensional Gaussian centered at the origin, with a width that grows over time.

## What is the math?

Each particle's position $X_t \in \mathbb{R}^3$ evolves under the stochastic differential equation

$$
dX_t = \sigma \, dW_t,
$$

where $W_t$ is a standard 3D Wiener process — three mutually independent one-dimensional Brownian motions, one per coordinate — and $\sigma > 0$ is the diffusion coefficient. A 3D Brownian motion is, by construction, three independent 1D Brownian motions stacked into a vector.

The transition density from the origin at time $t$ is the isotropic 3D Gaussian

$$
p(\mathbf{x}, t) = \frac{1}{(2\pi\sigma^{2} t)^{3/2}} \exp\!\left(-\frac{\lVert \mathbf{x} \rVert^{2}}{2\sigma^{2} t}\right),
$$

a Gaussian centered at the origin with variance $\sigma^{2} t$ in every coordinate. The standard deviation grows as $\sigma\sqrt{t}$, so the cloud's typical radius scales with the *square root* of elapsed time — not linearly. That square root is the qualitative signature of diffusion as opposed to ballistic transport.

The same density $p(\mathbf{x}, t)$ satisfies the heat equation

$$
\frac{\partial p}{\partial t} = \frac{\sigma^{2}}{2} \, \Delta p,
$$

where $\Delta$ is the 3D Laplacian. Brownian motion is the stochastic counterpart to heat diffusion; the density of independent walkers obeys the same partial differential equation as heat in a uniform medium (Mörters and Peres 2010; Karatzas and Shreve 1991). The link is older than the formal theory of stochastic processes — Einstein derived it for suspended particles in 1905 (Einstein 1905), several years before Wiener constructed Brownian motion as a rigorous object.

## Why is it interesting?

Brownian motion sits at the base of a long list of models. Geometric Brownian motion — the exponential of a drifted Brownian motion — is the foundation of the Black–Scholes option pricing model and most of mathematical finance. Langevin dynamics adds a deterministic drift to the same SDE and is the workhorse of molecular simulation and gradient-based sampling. Particle filters in robotics and target tracking propagate clouds of hypotheses under noise that is, at root, the same Gaussian increment used here. Score-based generative models — the diffusion models behind much of modern image synthesis — define a forward process that is precisely this SDE and learn to reverse it. The equation $dX_t = \sigma\, dW_t$ is the same equation in every case. What differs across these models is the drift term, the dimension, and what $X_t$ is taken to represent — a price, a particle, a hypothesis, a noisy image.

## How was it built?

Three.js renders one hundred thousand particles as a single `THREE.Points` mesh backed by a `Float32Array` of length $3N$. Each frame, all $3N$ coordinates are incremented in JavaScript by $\sigma\sqrt{\Delta t}$ times an independent standard normal, then the whole buffer is uploaded to the GPU via a dynamic `BufferAttribute`. The standard normals come from the Box–Muller transform; both samples produced by each call are used (the second is cached for the following call) so no random budget is wasted. A small radial-gradient sprite is generated at mount time so density emerges from alpha accumulation against the light background rather than from additive glow, which would brighten incorrectly toward white. The user orbits with `OrbitControls`; panning is disabled to keep the origin at the centre of attention. The simulation is currently CPU-bound — comfortable at 100k particles on a recent laptop — and a later piece will revisit the same problem with a WebGPU compute backend at much higher counts.
