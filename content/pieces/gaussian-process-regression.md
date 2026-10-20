---
title: Gaussian Process Regression
slug: gaussian-process-regression
published: 2026-10-20
modified: 2026-10-20
version: 1.0.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/gaussian-process-regression
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'Gaussian Process Regression: A Posterior Over Functions'
summary: 'Noisy observations condition a Gaussian process prior over functions: the posterior band tightens near data and relaxes between them.'
learning_objectives:
  - Read a Gaussian process as a prior over whole functions, specified by a mean and a covariance kernel.
  - Derive the posterior mean and covariance by conditioning a joint Gaussian on observed values.
  - Connect the kernel length scale and the noise level to the shape of the posterior.
  - Distinguish a pointwise credible band from a set of plausible whole functions.
limitations:
  - The interactive uses a zero-mean prior with a squared-exponential kernel and a fixed signal standard deviation.
  - The length scale and noise are set by hand; they are not estimated from the data.
  - The posterior band is for the latent function, not for a new noisy observation.
math_topics:
  - Gaussian processes
  - Bayesian nonparametric regression
  - multivariate Gaussian conditioning
  - covariance kernels
techniques:
  - Canvas 2D
  - Cholesky factorisation
  - seeded pseudorandom generator
references:
  - kind: paper
    author: O'Hagan, A.
    title: Curve fitting and optimal design for prediction
    year: 1978
    venue: Journal of the Royal Statistical Society, Series B
    volume: '40'
    issue: '1'
    pages: 1-42
    url: https://doi.org/10.1111/j.2517-6161.1978.tb01643.x
    doi: 10.1111/j.2517-6161.1978.tb01643.x
  - kind: paper
    author: Williams, C. and Rasmussen, C.
    title: Gaussian processes for regression
    year: 1996
    venue: Advances in Neural Information Processing Systems
    volume: '8'
    pages: 514-520
  - kind: book
    author: Rasmussen, C. and Williams, C.
    title: Gaussian Processes for Machine Learning
    year: 2006
    venue: MIT Press
    url: https://gaussianprocess.org/gpml/
    isbn: '026218253X'
preview_image: /pieces/gaussian-process-regression/preview.svg
social_image: /pieces/gaussian-process-regression/social-card.png
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/pieces/gaussian-process-regression/model.ts
downloads:
  - label: Gaussian process figure
    url: /pieces/gaussian-process-regression/preview.svg
    format: SVG
    description: Static fallback and slide-ready figure
---

::gaussian-process-regression
::

## What is this?

The figure is a Bayesian regression where the unknown quantity is a whole function rather than a handful of parameters. Before any data arrive, the teal band shows the prior: at every input $x$, the function value $f(x)$ is believed to lie within about two units of zero, and nearby inputs are believed to have similar values.

The orange points are noisy observations. Conditioning on them gives the navy posterior. Its band pinches in around each observation and widens again in the gaps, where the data say little and the prior takes over. The thin navy curves are individual functions drawn from the posterior, each one a smooth curve that is consistent with both the prior and the data.

Click anywhere in the plot to add an observation, or click an existing point to remove it. The buttons do the same from the keyboard, drawing new observations from a hidden function with noise standard deviation 0.18.

## What is the math?

A Gaussian process $f \sim \mathcal{GP}(0, k)$ is a distribution over functions such that any finite set of values $f(x_1),\ldots,f(x_m)$ is jointly Gaussian, with mean zero and covariance $\operatorname{Cov}[f(x_i), f(x_j)] = k(x_i, x_j)$. The figure uses the squared-exponential kernel

$$
k(x, x') = \sigma_f^2 \exp\!\left(-\frac{(x - x')^2}{2\ell^2}\right),
$$

with $\sigma_f = 1$. The length scale $\ell$ sets how quickly the correlation between two function values decays with distance.

Observations are $y_i = f(x_i) + \varepsilon_i$ with independent $\varepsilon_i \sim \mathcal N(0, \sigma_n^2)$. Write $K = k(X, X)$ for the $n \times n$ kernel matrix at the observed inputs and $\mathbf k_* = k(X, x_*)$ for the covariances between those inputs and a test input $x_*$. The observations and $f(x_*)$ are jointly Gaussian, and conditioning on $\mathbf y$ gives a Gaussian posterior with

$$
m(x_*) = \mathbf k_*^\top (K + \sigma_n^2 I)^{-1} \mathbf y,
\qquad
s^2(x_*) = k(x_*, x_*) - \mathbf k_*^\top (K + \sigma_n^2 I)^{-1} \mathbf k_*.
$$

The posterior variance is the prior variance minus a nonnegative term that is large only when $x_*$ is close to the data, measured in units of $\ell$. That is why the band narrows near the orange points and returns to the prior far away. The navy band is $m(x_*) \pm 1.96\, s(x_*)$, a pointwise 95% credible band for $f(x_*)$.

The panel also reports the log marginal likelihood, the log density of the observed $\mathbf y$ with $f$ integrated out:

$$
\log p(\mathbf y \mid X) = -\tfrac12 \mathbf y^\top (K + \sigma_n^2 I)^{-1} \mathbf y - \tfrac12 \log\lvert K + \sigma_n^2 I\rvert - \tfrac{n}{2} \log 2\pi.
$$

The first term rewards fitting the data. The second penalises a covariance that could have explained many other datasets equally well.

## Why is it interesting?

Most of the Bayesian pieces on this site update a distribution over a few numbers. Here the same operation, conditioning a joint Gaussian, acts on a distribution over whole functions, and with Gaussian noise the update remains available in closed form. The idea has a long history in statistics (O'Hagan 1978) and was taken up in machine learning as a flexible regression model (Williams and Rasmussen 1996). The posterior mean is a kernel-weighted combination of the observations, the same curve that kernel ridge regression produces as a regularised smoother. What the Bayesian reading adds is the band.

The figure makes two consequences of the prior visible. First, uncertainty depends on where the data are, not only on how many there are: one dense cluster leaves the rest of the domain almost as uncertain as before. Second, the hyperparameters matter. Drag $\ell$ toward 0.3 and the posterior chases each point, then snaps back to the prior within a short distance. Drag it toward 3 and the posterior commits to a slow curve that cannot follow the data. The log marginal likelihood is the usual criterion for choosing $\ell$ and $\sigma_n$ (Rasmussen and Williams 2006), but it is only as informative as the data. With the six opening points it penalises long length scales sharply and is nearly flat across short ones. After a dozen or so more observations, it develops a clearer peak near $\ell = 0.8$. Even then the maximiser is an estimate, and treating it as known understates the uncertainty.

The band and the sample curves answer different questions. The band says where $f(x)$ is likely to be at each $x$ separately. A sample curve is one function that is plausible as a whole, so it can stray near the edge of the band at some inputs while staying near the middle at others.

## How was it built?

The posterior is computed on a grid of 120 inputs. Each change to the data or the sliders rebuilds the kernel matrix, factorises $K + \sigma_n^2 I = L L^\top$ by Cholesky decomposition, and applies every inverse through triangular solves rather than forming it explicitly. The 120 × 120 posterior covariance is factorised once more, after a small diagonal jitter, so that whole functions can be drawn as $m + L_* z$ with $z \sim \mathcal N(0, I)$.

The sample curves move along great circles: with two fixed standard normal vectors $z_1$ and $z_2$, the vector $z_1 \cos\theta + z_2 \sin\theta$ is again standard normal for every angle $\theta$. Advancing $\theta$ slowly therefore gives a smooth animation in which every frame is an exact posterior draw. The vectors persist when the data change, so a curve keeps its identity and is pulled through a new observation instead of being replaced.

The canvas pauses while off-screen or while the document is hidden, and the static figure stays in place until motion preferences are known. Visitors who prefer reduced motion can start the figure explicitly.

## Questions to try

1. Clear the data. What does the posterior look like with $n = 0$, and why do the sample curves still look smooth?
2. Add several observations close together near $x = 2$. How much does the band narrow at $x = 6$?
3. Click two points close together at different heights, then set $\sigma_n$ to 0.02, well below the true noise. What happens to the curves between them?
4. Move $\ell$ across its range and watch the log marginal likelihood. Then add fifteen observations and repeat. How does the shape of the criterion change?

## Assumptions and limitations

The prior has mean zero and a squared-exponential kernel, which assumes the function is very smooth and equally variable everywhere. Other kernels, such as the Matérn family, encode rougher or periodic structure. The signal standard deviation is fixed at 1, and the length scale and noise are set by hand rather than estimated, so the band does not include uncertainty about the hyperparameters. The navy band covers the latent function; a band for a new noisy observation would add $\sigma_n^2$ to the variance. Exact inference costs $O(n^3)$ in the number of observations, which is negligible here at 30 points and the main obstacle for large datasets.
