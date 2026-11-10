---
title: Bayesian Optimisation
slug: bayesian-optimisation
published: 2026-11-10
modified: 2026-11-10
version: 1.0.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/bayesian-optimisation
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'Bayesian Optimisation: Choosing the Next Observation'
summary: 'A Gaussian process posterior becomes a decision about where to evaluate next, exposing the tradeoff between a promising prediction and an uncertain region.'
learning_objectives:
  - 'Read expected improvement as an average over the posterior at a candidate input.'
  - 'Distinguish the objective, its surrogate, and the acquisition function.'
  - 'Explain how kernel assumptions change the sequence of evaluations.'
  - 'Recognise the limitations of a finite acquisition grid and fixed hyperparameters.'
limitations:
  - 'The objective is fixed, one-dimensional, and observed without noise.'
  - 'Expected improvement is maximised over a finite grid.'
  - 'The Gaussian process hyperparameters are set by hand.'
math_topics: ['Bayesian optimisation', 'Gaussian processes', 'expected improvement', 'sequential experimental design']
techniques: [SVG, seeded simulation, small dense matrix algebra]
references:
  - kind: 'preprint'
    author: 'Brochu, E., Cora, V. M. and de Freitas, N.'
    title: 'A tutorial on Bayesian optimization of expensive cost functions, with application to active user modeling and hierarchical reinforcement learning'
    year: 2010
    venue: 'arXiv'
    url: 'https://arxiv.org/abs/1012.2599'
  - kind: 'book'
    author: 'Rasmussen, C. and Williams, C.'
    title: 'Gaussian Processes for Machine Learning'
    year: 2006
    venue: 'MIT Press'
    url: 'https://gaussianprocess.org/gpml/'
preview_image: /pieces/bayesian-optimisation/preview.svg
preview_video: /pieces/bayesian-optimisation/preview.webm
social_image: /pieces/bayesian-optimisation/social-card.png
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/pieces/bayesian-optimisation/model.ts
downloads:
  - label: Bayesian Optimisation figure
    url: /pieces/bayesian-optimisation/preview.svg
    format: SVG
    description: Static figure generated with the interactive model
---

::bayesian-optimisation
::

## What is this?

The next evaluation is chosen at $x \approx 6.58$, where the posterior mean is about −0.04, rather than at $x = 2$, where it is about 0.97. The uncertain point wins because its expected improvement is slightly larger, about 0.085 against 0.077: its posterior standard deviation is about 1.0, against 0.17 at the confident point. Those are the two candidates compared in the opening figure.

The upper panel shows the Gaussian process posterior over a hidden objective. Orange points are completed evaluations; the grey objective is visible for comparison but unavailable to the search. The middle panel shows expected improvement and marks its maximum. The two small panels below compare the predictive distributions at A, the chosen input, and B, the highest-mean unvisited alternative.

The vertical threshold is the best observed value plus the improvement margin. Shading marks outcomes above it. Expected improvement weights those outcomes by how far they exceed the threshold, so the area of the shaded density alone does not determine the decision. Both panels share the horizontal function-value scale and have separately labelled density scales.

Use **Evaluate suggested input** to obtain that point's value, condition the posterior, and inspect the next decision. Kernel length scale and improvement margin live under **Model settings**. Changing either rebuilds the search from the same three starting points, so the comparison is between complete searches rather than a change of assumptions partway through one.

## What is the math?

The objective is an unknown function $f(x)$ on $0\leq x\leq10$. We place the same zero-mean, squared-exponential Gaussian process prior on it as in the [regression piece](/pieces/gaussian-process-regression), with signal variance one:

$$
k(x,x')=\exp\!\left(-\frac{(x-x')^2}{2\ell^2}\right).
$$

After observing $D_n=\{(x_i,f(x_i))\}_{i=1}^n$, let $A=K+\eta I$, where $K=k(X,X)$ and the small numerical nugget is $\eta=10^{-6}$. Write $\mathbf y$ for the observed values and $\mathbf k_x=k(X,x)$ for the covariances between the evaluated inputs and a candidate $x$. The posterior has mean and variance

$$
\begin{aligned}
m_n(x)&=\mathbf k_x^\top A^{-1}\mathbf y,\\
s_n^2(x)&=1-\mathbf k_x^\top A^{-1}\mathbf k_x.
\end{aligned}
$$

Write $f_n^\star=\max_i f(x_i)$ for the best observed value. Improvement with margin $\xi\geq0$ is

$$
I_n(x)=\max\{0,f(x)-f_n^\star-\xi\}.
$$

The acquisition function is its posterior expectation. With $\delta=m_n(x)-f_n^\star-\xi$ and $s=s_n(x)$,

$$
\operatorname{EI}_n(x)
=\delta\,\Phi(\delta/s)+s\,\phi(\delta/s),
$$

where $\Phi$ and $\phi$ are the standard normal distribution function and density. When $s$ is zero, the expression reduces to $\max(0,\delta)$. The next input maximises expected improvement over the unvisited candidate grid (Brochu et al. 2010).

The objective and acquisition function have different roles. Evaluating $f$ produces new information; evaluating EI only uses the current surrogate. The grey curve is drawn so the result can be checked, but none of its unevaluated values enters the acquisition calculation.

## Why is it interesting?

The [Gaussian process regression](/pieces/gaussian-process-regression) piece asks what the data tell us about a function. Bayesian optimisation asks what we should measure next. The posterior band becomes part of a decision rule, and its width can matter as much as the posterior mean. A region with a modest predicted value can still deserve an evaluation if the model leaves enough probability for a substantially better one.

This is useful when the orange points are expensive: an experiment, a physical prototype, or a model-training run. Fitting a surrogate and searching an acquisition function can be worthwhile if it saves even a few such evaluations. The objective here is deliberately cheap so the full curve can remain visible; the search itself receives only the evaluations it chooses.

The length scale exposes how strongly that decision depends on the prior. A short length scale lets one observation say little about its neighbours, leaving many regions uncertain. A long one makes observations influence much more of the domain, but can smooth away a narrow feature. Expected improvement can then be computed exactly for a posterior whose assumptions do not suit the function (Rasmussen and Williams 2006).

The improvement margin changes what counts as a useful gain. Increasing it requires a candidate to exceed the incumbent by more, which can shift attention towards uncertainty. It is not a guarantee that the next point moves farther away or that the final result improves. Watch the evaluation locations as well as the best observed value: the latter can stay flat while the search acquires information elsewhere.

## How was it built?

The search begins at inputs 0.5, 4.5, and 8.5. Each subsequent decision evaluates posterior means and variances at 121 evenly spaced candidates, excludes previously queried inputs, and selects the remaining point with largest EI. The objective is a sum of two sinusoids. There is no observation noise, and at most eighteen evaluations are shown.

The model reuses the regression piece's kernel and Cholesky routines. It computes only the marginal variances needed by EI, without constructing a full posterior covariance over the candidate grid. Every inverse is applied through triangular solves. The normal distribution function uses a polynomial approximation, and tiny negative acquisition values from floating-point cancellation are clipped to zero.

The comparison chooses B by maximising posterior mean over unvisited candidates other than A. Each predictive curve uses its actual posterior standard deviation, with additional plotting samples near the mean to resolve narrow densities. The shaded part is a tail probability region; the EI number is calculated analytically and includes improvement magnitude.

Each evaluation has three visible stages: the orange observation arrives, the posterior conditions on it, and the selection cursor moves along the updated acquisition curve. Between completed evaluations, the figure interpolates the displayed mean and variance for continuity; those frames do not represent additional observations. Inference is computed at update boundaries, while animation changes existing SVG paths on each frame. **Evaluate suggested input** completes one evaluation and pauses. **Play sequence** advances through the remaining evaluation budget and stops. The figure pauses off-screen and in hidden tabs; reduced motion leaves the static comparison in place until the interactive is started. The suggested input and best observed value are also reported as text.

## Questions to try

1. Advance one evaluation at a time. Does the suggested input always maximise the posterior mean?
2. Replay the search at length scales 0.3 and 2. Which parts of the function are explored first?
3. Increase the improvement margin. Does the next evaluation change, and does the best observed value improve sooner?
4. Near the evaluation limit, where does the band remain wide? Has locating a good maximum also identified the whole function?

## Assumptions and limitations

The example maximises one deterministic function on a bounded one-dimensional domain. Its Gaussian process has a fixed signal scale and manually selected hyperparameters; their uncertainty is excluded. The nugget stabilises computation rather than modelling real measurement noise. The acquisition search is restricted to a grid, so it can miss a better input between candidates. Expected improvement here is a one-step decision rule with an observed incumbent; noisy objectives need additional care in defining improvement and distinguishing a high reading from a high latent function value. The posterior band is pointwise and conditional on the chosen kernel.
