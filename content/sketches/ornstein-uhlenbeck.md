---
title: Ornstein–Uhlenbeck
slug: ornstein-uhlenbeck
published: 2026-05-19
equation_latex: dX_t = -\theta\,(X_t - \mu)\,dt + \sigma\, dW_t
distribution_or_process: Ornstein–Uhlenbeck process
one_sentence_description: A random path repeatedly displaced by noise and pulled back toward a fixed mean.
preview_clip: /sketches/ornstein-uhlenbeck.mp4
---

$$
dX_t = -\theta(X_t-\mu)\,dt + \sigma\,dW_t.
$$

The drift term $-\theta(X_t-\mu)$ points toward $\mu$ and grows with the displacement from it. The diffusion term $\sigma\,dW_t$ continually perturbs the path. With constant parameters, the stationary distribution is Gaussian with mean $\mu$ and variance $\sigma^2/(2\theta)$.
