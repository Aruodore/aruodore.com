---
title: On the square root of time
slug: on-the-square-root-of-time
published: 2026-05-19
topics:
  - Brownian motion
  - scaling
---

The first thing that surprises people about Brownian motion is the scaling. If you let it run for time $t$, the particle is typically $\sigma\sqrt{t}$ away from where it started, not $\sigma t$. Doubling the time does not double the distance; it multiplies it by $\sqrt{2} \approx 1.41$.

This is not a quirk of the simulation. It falls directly out of the definition: increments over disjoint intervals are independent Gaussians, and variances of independent random variables add. After $n$ steps of variance $\sigma^2 \Delta t$ each, the total variance is $n\,\sigma^2 \Delta t = \sigma^2 t$, so the standard deviation is $\sigma\sqrt{t}$.

The consequence is everywhere once you start looking for it. A diffusing molecule covers a millimetre in seconds and a centimetre in hours; biological systems exploit this to make short-range chemical signalling fast and long-range signalling slow, without changing any of the chemistry. The same scaling shows up in random walks on graphs, in mixing times of Markov chains, and in the convergence rate of Monte Carlo estimators — the standard error of an $n$-sample mean falls as $1/\sqrt{n}$ for the same reason.

The next time someone says "I'll just run more samples," remember this: to halve the error, you need four times the data.
