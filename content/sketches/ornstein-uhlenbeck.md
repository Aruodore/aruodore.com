---
title: Ornstein–Uhlenbeck
slug: ornstein-uhlenbeck
published: 2026-05-19
equation_latex: dX_t = -\theta\,(X_t - \mu)\,dt + \sigma\, dW_t
distribution_or_process: Ornstein–Uhlenbeck process
one_sentence_description: A mean-reverting diffusion — the noisy spring of stochastic processes.
---

The OU process is what you get when you tether Brownian motion to a point. The drift term $-\theta(X_t - \mu)$ pulls the process back toward $\mu$ at a rate proportional to its displacement; the diffusion term $\sigma\,dW_t$ keeps it from settling. The stationary distribution is Gaussian with mean $\mu$ and variance $\sigma^2 / 2\theta$.
