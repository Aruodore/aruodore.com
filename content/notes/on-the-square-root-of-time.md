---
title: On the square root of time
slug: on-the-square-root-of-time
published: 2026-05-19
topics:
  - Brownian motion
  - scaling
---

Brownian motion scales with the square root of elapsed time. In one dimension, the standard deviation of a process with noise amplitude $\sigma$ at time $t$ is $\sigma\sqrt{t}$. Doubling the time multiplies this scale by $\sqrt{2} \approx 1.41$ rather than by two.

This is not a quirk of the simulation. It falls directly out of the definition: increments over disjoint intervals are independent Gaussians, and variances of independent random variables add. After $n$ steps of variance $\sigma^2 \Delta t$ each, the total variance is $n\,\sigma^2 \Delta t = \sigma^2 t$, so the standard deviation is $\sigma\sqrt{t}$.

The same variance calculation explains the familiar $1/\sqrt{n}$ scale of Monte Carlo error. For independent samples with finite variance, the variance of their mean is the variance of one sample divided by $n$. Its standard error therefore decreases as $1/\sqrt{n}$.

The rate is slow in practical terms. Halving the standard error requires four times as many independent samples.
