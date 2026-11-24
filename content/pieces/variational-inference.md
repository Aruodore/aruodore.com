---
title: Variational Inference
slug: variational-inference
published: 2026-11-24
modified: 2026-11-24
version: 1.0.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/variational-inference
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'Variational Inference: Fitting a Posterior and Losing Its Shape'
summary: 'An independent Gaussian approximation is fitted to a correlated posterior, separating optimisation progress from uncertainty that the chosen family cannot represent.'
learning_objectives:
  - 'Read variational inference as optimisation over a family of distributions.'
  - 'Connect the evidence lower bound to reverse KL divergence.'
  - 'Derive the optimal mean-field variances for a correlated Gaussian target.'
  - 'Distinguish optimisation error from approximation error.'
limitations:
  - 'The target is a known bivariate Gaussian, allowing exact KL calculations.'
  - 'The approximation is restricted to independent Gaussian coordinates.'
  - 'Coordinate updates are analytic and do not represent the computational demands of a general model.'
math_topics: ['Variational inference', 'mean-field approximation', 'Kullback-Leibler divergence', 'coordinate ascent']
techniques: [SVG, seeded simulation, small dense matrix algebra]
references:
  - kind: 'paper'
    author: 'Blei, D. M., Kucukelbir, A. and McAuliffe, J. D.'
    title: 'Variational inference: A review for statisticians'
    year: 2017
    venue: 'Journal of the American Statistical Association'
    volume: '112'
    issue: '518'
    pages: '859-877'
    doi: '10.1080/01621459.2017.1285773'
    url: 'https://arxiv.org/abs/1601.00670'
  - kind: book
    author: Bishop, C. M.
    title: Pattern Recognition and Machine Learning
    year: 2006
    venue: Springer
    locator: Chapter 10
    url: https://www.microsoft.com/en-us/research/people/cmbishop/prml-book/
preview_image: /pieces/variational-inference/preview.svg
preview_video: /pieces/variational-inference/preview.webm
social_image: /pieces/variational-inference/social-card.png
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/pieces/variational-inference/model.ts
downloads:
  - label: Variational Inference figure
    url: /pieces/variational-inference/preview.svg
    format: SVG
    description: Static figure generated with the interactive model
---

::variational-inference
::

## What is this?

The optimiser can finish while its answer remains too certain. At the opening correlation of 0.85, the best independent Gaussian has marginal standard deviations of about 0.527. The target's marginal standard deviations are both one. Further fitting cannot recover that missing width within this family.

The solid ellipses are contours of the correlated Gaussian target. The dashed ellipses belong to an approximation whose coordinates must be independent. Each sweep fits the first coordinate, then the second. The grey path records the means, and the adjacent density panel makes the lost marginal width visible.

The lower plot separates fitting error from the restriction imposed by the family. Its shaded floor is the smallest attainable KL divergence. The curve's height above that floor is unfinished optimisation. The vertical scale uses $\log(1+D_{\mathrm{KL}}/0.1)$, with tick labels in the original KL units, so the residual floor remains visible beside the much larger initial error.

Use **Fit next sweep** to follow the two coordinate updates. Continuous playback pauses when the remaining fitting error falls below 0.01 nats, or at forty sweeps. Set the target correlation to zero to make the restriction disappear, then increase it to see the narrow approximation return. **Step fraction α** under **Model settings** changes the speed of fitting but not the best attainable KL.

## What is the math?

Let the target be $p(x)=\mathcal N(\mu,\Sigma)$ with $\mu=(0.8,-0.5)^\top$ and

$$
\Sigma=\begin{pmatrix}1&\rho\\\rho&1\end{pmatrix}.
$$

The approximation factorises,

$$
q(x)=q_1(x_1)q_2(x_2),
\qquad q_j=\mathcal N(m_j,v_j).
$$

Variational inference chooses its parameters by minimising

$$
D_{\mathrm{KL}}(q\Vert p)
=\mathbb E_q[\log q(x)-\log p(x)].
$$

For a posterior $p(x\mid y)$, the same objective is usually written through the evidence lower bound,

$$
\mathcal L(q)=\mathbb E_q[\log p(x,y)-\log q(x)],
$$

with $\log p(y)=\mathcal L(q)+D_{\mathrm{KL}}(q\Vert p(x\mid y))$. The evidence does not depend on $q$, so maximising the bound minimises the divergence (Bishop 2006; Blei et al. 2017). Here the target is normalised and known, which lets the figure report KL directly.

Writing $a=m_1-\mu_1$ and $b=m_2-\mu_2$, Gaussian integration gives

$$
\begin{aligned}
D_{\mathrm{KL}}(q\Vert p)
&=\frac{v_1+v_2+a^2-2\rho ab+b^2}{2(1-\rho^2)}\\
&\quad-1+\frac12\log\frac{1-\rho^2}{v_1v_2}.
\end{aligned}
$$

Holding the other factor fixed, the optimal coordinate means are

$$
\begin{aligned}
m_1^\star&=\mu_1+\rho(m_2-\mu_2),\\
m_2^\star&=\mu_2+\rho(m_1-\mu_1).
\end{aligned}
$$

Each sweep updates the first coordinate, then uses its new mean for the second. Both optimal variances are $v_j^\star=1-\rho^2$. The step fraction $\alpha$ moves each mean a fraction $\alpha$ of the way towards its coordinate optimum, and each variance geometrically as $v_j\leftarrow v_j^{1-\alpha}(1-\rho^2)^\alpha$. At $\alpha=1$ each update jumps to its coordinate optimum; smaller values damp the update.

At the overall optimum, $m=\mu$, but the marginal variances are $1-\rho^2$ rather than one. The smallest attainable divergence is

$$
D_{\mathrm{KL}}^{\star}=-\tfrac12\log(1-\rho^2).
$$

At $\rho=0.85$ this floor is about 0.64 nats.

## Why is it interesting?

The [Metropolis](/pieces/metropolis-hastings), [Gibbs](/pieces/gibbs-sampling), and [Hamiltonian Monte Carlo](/pieces/hamiltonian-monte-carlo) pieces approximate a distribution by collecting draws. Variational inference instead searches for a distribution that is convenient to store and optimise. Once fitted, this example needs only two means and two variances, but those four numbers cannot encode correlation.

The direction of the divergence decides how that restriction is resolved. Reverse KL averages under $q$, so it penalises the approximation for putting mass where the target has little. An independent distribution with the target's full marginal widths would place too much probability away from its diagonal ridge. The optimum contracts both widths, keeping more mass in the ridge while losing uncertainty along it. Each fitted standard deviation approaches $\sqrt{1-\rho^2}$, about 0.527 at $\rho=0.85$.

Those fitted variances equal the target's conditional variances. This connects the picture to the narrow conditional draws in the Gibbs sampling piece, but the consequences differ. Gibbs alternates those conditional draws and can eventually explore the full joint distribution. The mean-field approximation represents its two coordinates separately, so no amount of optimisation restores the missing correlation.

The lower plot separates two sources of error. The distance from the current KL value to the floor is unfinished optimisation. The floor itself is the approximation error imposed by the family. More sweeps or a larger step fraction can reduce the first; changing the family is needed to reduce the second. A full-covariance Gaussian could represent this particular target exactly.

## How was it built?

The model calculates KL and coordinate optima analytically. There are no Monte Carlo gradients or density estimates in the objective, so a change in the curve is optimisation progress rather than sampling noise. The initial approximate mean is $(-2,1.8)$ with standard deviations 1.4 and 1. Changing correlation or step fraction rebuilds forty sweeps from that same starting distribution.

The renderer draws contours at Mahalanobis radii one and two for each Gaussian. These are density contours, not labelled 95% regions. The floor in the lower plot is calculated from the analytic optimum, and the text readout compares the fitted marginal standard deviations with the target values.

The figure opens before the first sweep. Each sweep moves the first coordinate while holding the second fixed, then updates the second using the newly fitted first coordinate. The contours, marginal, and exact KL readout follow the same intermediate Gaussian throughout. The 0.01-nat playback stopping rule is a demonstration convenience, not an assertion that the approximation is calibrated. The sweep slider can still inspect all forty stored states. Moving a slider pauses for inspection. The SVG is shared with the static fallback, and the figure pauses off-screen and in hidden tabs. Visitors who prefer reduced motion can start it explicitly.

## Questions to try

1. Set correlation to zero and run forty sweeps. Can the approximation reach the target?
2. Increase correlation to 0.85. Why do the approximate standard deviations fall while the target values stay fixed?
3. Compare step fractions at the same correlation. Which changes the best possible KL, and which changes only progress towards it?
4. At high correlation, is a nearly flat optimisation curve enough to establish an accurate approximation?

## Assumptions and limitations

The target is a known Gaussian chosen so the approximation error can be measured exactly. General posteriors may be skewed or multimodal, with expectations and coordinate updates that are unavailable in closed form. This figure isolates a mean-field restriction; it does not claim that every variational method underestimates every uncertainty measure. The run is limited to forty sweeps, so the current approximation may still be away from its optimum. The plotted contours show only a bounded part of two unbounded distributions. The family, objective, and optimisation algorithm all matter, and success on one of them does not establish posterior calibration.
