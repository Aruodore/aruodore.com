---
title: First Passage
slug: first-passage
published: 2026-08-10
modified: 2026-08-10
version: 1.0.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/first-passage
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'First Passage of Brownian Motion: Hitting Times and the Reflection Principle'
summary: Brownian paths stop at an absorbing boundary, revealing the heavy-tailed distribution of their first hitting times.
learning_objectives:
  - Define a first hitting time as a random variable determined by an entire path.
  - Relate the distribution of Brownian hitting times to the reflection principle.
  - Compare an empirical crossing fraction with its theoretical probability.
limitations:
  - The piece considers one-dimensional Brownian motion with zero drift and one upper boundary.
  - Paths are sampled on a finite time grid, so crossings between displayed steps can be missed.
  - The finite display window does not capture the full heavy tail of the hitting-time distribution.
math_topics:
  - Brownian motion
  - stopping times
  - first-passage distributions
  - reflection principle
techniques:
  - Canvas 2D
  - Monte Carlo simulation
  - Box-Muller transform
  - empirical distribution comparison
references:
  - kind: book
    author: Karatzas, I. and Shreve, S.
    title: Brownian Motion and Stochastic Calculus
    year: 1991
    venue: Springer
  - kind: book
    author: Redner, S.
    title: A Guide to First-Passage Processes
    year: 2001
    venue: Cambridge University Press
  - kind: book
    author: Mörters, P. and Peres, Y.
    title: Brownian Motion
    year: 2010
    venue: Cambridge University Press
preview_image: /pieces/first-passage/preview.svg
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/pieces/first-passage/simulation.ts
downloads:
  - label: First-passage figure
    url: /pieces/first-passage/preview.svg
    format: SVG
    description: Static fallback and slide-ready figure
---

::first-passage
::

## What is this?

Each orange line is one realisation of one-dimensional Brownian motion. Every path begins at zero and evolves until it first reaches the boundary. At that instant the path stops. Its stopping time is recorded in the strip below the main plot.

The two percentages compare the fraction of simulated paths that have crossed by the current time with the theoretical probability. Moving the boundary farther away delays crossings. Increasing the noise amplitude makes the paths spread more quickly and brings crossings forward.

## What is the math?

Let $X_t=\sigma W_t$, where $W_t$ is standard Brownian motion and $\sigma>0$ is the noise amplitude. For a boundary $a>0$, the first hitting time is

$$
\tau_a=\inf\{t\geq 0:X_t\geq a\}.
$$

The event $\{\tau_a\leq t\}$ depends on the maximum of the whole path up to time $t$, not only on its endpoint. The reflection principle gives

$$
\begin{aligned}
\Pr(\tau_a\leq t)
&=\Pr\!\left(\max_{0\leq s\leq t}X_s\geq a\right) \\
&=2\left[1-\Phi\!\left(\frac{a}{\sigma\sqrt{t}}\right)\right].
\end{aligned}
$$

where $\Phi$ is the standard normal cumulative distribution function. Differentiating gives the hitting-time density

$$
\begin{aligned}
f_{\tau_a}(t)
&=\frac{a}{\sigma\sqrt{2\pi t^3}}
\exp\!\left(-\frac{a^2}{2\sigma^2t}\right), \\
&\hspace{8em} t>0.
\end{aligned}
$$

The density has a long right tail. A Brownian path reaches every fixed positive level eventually with probability one, but the expected time required is infinite. A typical crossing time is therefore meaningful while the arithmetic mean is not.

## Why is it interesting?

First passage changes the question asked of a stochastic process. Position asks where a process is at a specified time. First passage asks when a specified event occurs. The latter appears in reliability, neuronal firing, chemical reactions, queueing, sequential tests, and barrier options (Redner 2001).

It also exposes a distinction that endpoint plots can hide. A path may cross the boundary and later finish below it. Looking only at $X_t$ would miss that earlier event. The reflection principle accounts for precisely those paths by reflecting the portion after their first crossing.

## How was it built?

The simulation uses the discrete update

$$
\begin{aligned}
X_{n+1}&=X_n+\sigma\sqrt{\Delta t}\,Z_n, \\
Z_n&\sim\mathcal N(0,1).
\end{aligned}
$$

Every path is generated in advance from a seeded pseudorandom sequence, making reset repeat the same experiment. Regenerate chooses a new seed. The first sampled point at or above the boundary is stored as that path's hitting time. Canvas 2D draws each path only as far as its recorded crossing and places the crossing time in the lower histogram. The histogram and theoretical density use one shared density scale, so their heights can be compared directly.

The theoretical value uses the reflection-principle formula above. The empirical value is the number of recorded hitting times no greater than the current display time divided by the number of paths. Their difference is ordinary Monte Carlo variation plus a small discretisation error from observing paths only at intervals of $\Delta t$.

## Questions to try

1. Double the boundary $a$. By what factor should the characteristic hitting-time scale change?
2. Double $\sigma$. How does that compensate for changing the boundary?
3. Why can a path finish below the boundary even if its first hitting time occurred earlier?

## Assumptions and limitations

The paths have zero drift, constant noise amplitude, one fixed upper boundary, and no lower boundary. Continuous Brownian motion can cross a boundary between two sampled times and return before the next sample, so the discrete simulation slightly undercounts crossings. The lower strip is restricted to the displayed time interval and does not represent the distribution's full tail.
