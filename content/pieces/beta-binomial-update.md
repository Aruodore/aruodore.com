---
title: Beta-Binomial Update
slug: beta-binomial-update
published: 2026-08-17
modified: 2026-08-17
version: 1.0.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/beta-binomial-update
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'Beta-Binomial Update: Conjugacy and Sequential Bayesian Inference'
summary: A beta prior meets Bernoulli trials one at a time, and the posterior responds to a probability it is never told.
learning_objectives:
  - Derive the beta posterior from a beta prior and Bernoulli data by matching functional forms.
  - Read the prior's effective sample size as a count of trials and weigh it against the observed sample size.
  - Distinguish a posterior credible interval from a normal approximation interval when the sample is small.
limitations:
  - The piece estimates one unknown Bernoulli probability, held fixed for the whole stream.
  - Trials are independent and identically distributed, which real sequences frequently are not.
  - The display stops at 120 trials, so it shows early concentration rather than asymptotic behaviour.
  - Credible intervals are equal-tailed rather than highest-density, so the two regions can differ for skewed or U-shaped posteriors.
math_topics:
  - Bayesian inference
  - conjugate priors
  - beta distribution
  - sequential updating
techniques:
  - Canvas 2D
  - Lanczos log-gamma approximation
  - continued fraction expansion
  - bisection quantiles
references:
  - kind: book
    author: Gelman, A., Carlin, J., Stern, H., Dunson, D., Vehtari, A. and Rubin, D.
    title: Bayesian Data Analysis
    year: 2013
    venue: CRC Press
  - kind: paper
    author: Diaconis, P. and Ylvisaker, D.
    title: Conjugate priors for exponential families
    year: 1979
    venue: The Annals of Statistics
    volume: '7'
    issue: '2'
    pages: 269-281
  - kind: paper
    author: Jeffreys, H.
    title: An invariant form for the prior probability in estimation problems
    year: 1946
    venue: Proceedings of the Royal Society A
    volume: '186'
    issue: '1007'
    pages: 453-461
  - kind: paper
    author: Agresti, A. and Coull, B.
    title: Approximate is better than "exact" for interval estimation of binomial proportions
    year: 1998
    venue: The American Statistician
    volume: '52'
    issue: '2'
    pages: 119-126
preview_image: /pieces/beta-binomial-update/preview.svg
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/pieces/beta-binomial-update/simulation.ts
downloads:
  - label: Beta-binomial update figure
    url: /pieces/beta-binomial-update/preview.svg
    format: SVG
    description: Static fallback and slide-ready figure
---

::beta-binomial-update
::

## What is this?

A single unknown probability is being estimated from coin flips. The teal curve is the prior: what is believed about that probability before any trial. The orange strip records the trials as they arrive, filled for a success and outlined for a failure. The navy curve is the posterior after everything the strip has shown so far, and the shaded region under it is the central 95% of that posterior.

The dashed vertical line is the probability the data are actually generated with. The posterior is never given that value. Watching the navy curve respond to each trial shows how an inference can gradually recover the generating probability, while still wandering with a finite random sample.

Two of the three controls set the prior. Moving them does not resample the data: the same trials are reused, so the effect of the prior can be read off a fixed dataset instead of being confounded with a fresh sample. Moving the third control changes the data-generating probability, which does require a new stream, so the run restarts.

## What is the math?

Let $p$ be the unknown success probability with a beta prior,

$$
\begin{aligned}
p&\sim\mathrm{Beta}(\alpha_0,\beta_0), \\
f(p)&=\frac{p^{\alpha_0-1}(1-p)^{\beta_0-1}}{B(\alpha_0,\beta_0)},
\end{aligned}
$$

where $B$ is the beta function. The trials $x_1,\dots,x_n$ are independent Bernoulli($p$) draws, so with $s=\sum_i x_i$ successes the likelihood is

$$
\Pr(x_1,\dots,x_n\mid p)=p^{s}(1-p)^{n-s}.
$$

The likelihood carries the same powers of $p$ and $1-p$ as the prior. Multiplying them and renormalising therefore cannot leave the beta family:

$$
\begin{aligned}
f(p\mid x)&\propto p^{\alpha_0+s-1}(1-p)^{\beta_0+n-s-1}, \\
p\mid x&\sim\mathrm{Beta}(\alpha_0+s,\ \beta_0+n-s).
\end{aligned}
$$

This closure is conjugacy. The update requires no integration, only two additions: successes accumulate on $\alpha$, failures on $\beta$. Diaconis and Ylvisaker (1979) show that for exponential families this behaviour characterises a specific class of priors rather than being a lucky coincidence of the beta density.

The posterior mean is a weighted average of the prior mean and the sample proportion,

$$
\mathbb{E}[p\mid x]=\frac{\alpha_0+s}{\alpha_0+\beta_0+n},
$$

which makes the interpretation of $\alpha_0$ and $\beta_0$ explicit: they act as prior weights corresponding to successes and failures. Their sum $\alpha_0+\beta_0$ is the prior's effective sample size. A $\mathrm{Beta}(2,2)$ prior is worth four trials, so it is overwhelmed quickly; a $\mathrm{Beta}(20,20)$ prior is worth forty and takes real data to move.

The same quantity is the posterior predictive probability of a success on the next trial, because conditioning on $p$ and integrating gives

$$
\Pr(x_{n+1}=1\mid x)=\mathbb{E}[p\mid x].
$$

The posterior standard deviation is

$$
\mathrm{sd}[p\mid x]=\sqrt{\frac{\alpha\beta}{(\alpha+\beta)^2(\alpha+\beta+1)}},
$$

with $\alpha=\alpha_0+s$ and $\beta=\beta_0+n-s$. The effective sample size sits in the denominator, which is where the familiar $1/\sqrt{n}$ contraction comes from.

The shaded band is the equal-tailed interval $[q_{0.025},q_{0.975}]$, where $q_u$ is the beta quantile. It is a region of parameter values holding 95% of posterior probability, which is a different claim from the coverage statement made by a confidence interval.

## Why is it interesting?

Conjugacy is usually introduced as a computational convenience, and it is one. The more useful consequence is interpretive: it turns a prior into a quantity on the same scale as the data. Asking "how many trials is this prior worth?" is a question a collaborator can answer, and comparing that number with $n$ predicts whether the prior or the data will dominate before either is examined.

Sequential updating also exposes an invariance worth noticing. Updating one trial at a time and updating once with the totals give the identical posterior, because only $s$ and $n$ enter. The order of the strip is irrelevant. That is not a property of Bayesian inference in general; it follows from the trials being exchangeable here, and it fails as soon as the data are ordered in a way the model does not encode.

The interval behaviour is where the small-sample case earns attention. After a handful of trials the posterior is visibly skewed, and a symmetric interval built from the posterior mean plus or minus two standard deviations can extend past 0 or 1. The quantile interval cannot. The same difficulty appears in frequentist form in the Wald interval for a proportion, whose poor behaviour near the boundaries motivated the adjusted intervals of Agresti and Coull (1998). Their adjustment adds two successes and two failures. This gives the same centre as the posterior mean under a $\mathrm{Beta}(2,2)$ prior, although the resulting confidence interval is constructed differently.

One thing the display makes easy to over-read: here a fixed true probability exists, and the posterior is rewarded for finding it. That is a property of the simulation, not of the world. The honest version of the claim is narrower, namely that if the model is right then the posterior concentrates (Gelman et al. 2013).

## How was it built?

The stream of 120 trials is drawn up front from a seeded generator, so replay repeats the same experiment and changing the prior is a controlled comparison. A running successes array turns the counts at any revealed trial into one lookup, which keeps the per-frame work independent of the sample size.

The posterior curve is the exact density, not a histogram or a fit, so the piece needs the beta density evaluated stably. Direct use of $\Gamma$ overflows well before $\mathrm{Beta}(60,60)$, so the normalising constant is computed as

$$
\log B(\alpha,\beta)=\log\Gamma(\alpha)+\log\Gamma(\beta)-\log\Gamma(\alpha+\beta),
$$

with $\log\Gamma$ from the Lanczos approximation and the density recovered by exponentiating once at the end.

The credible interval needs the beta quantile, which has no closed form. The cumulative distribution function is the regularised incomplete beta function $I_x(\alpha,\beta)$, evaluated by the standard continued fraction under modified Lentz iteration; the symmetry $I_x(\alpha,\beta)=1-I_{1-x}(\beta,\alpha)$ selects the faster-converging branch. Because that function is continuous and strictly increasing on $(0,1)$, the quantile is then recovered by bisection, which converges without requiring a derivative.

Two details are presentation rather than mathematics. Curves are sampled at cell midpoints instead of at 0 and 1, since a shape parameter below 1 sends the density to infinity at an endpoint. The vertical scale eases towards the tallest current curve rather than jumping, because the posterior peak grows without bound as trials accumulate and an instantaneous rescale would flatten the prior into the baseline in a single frame.

## Questions to try

1. Set both prior parameters to their maximum and predict how many trials it takes before the posterior mean passes halfway from the prior mean to the sample proportion.
2. Fix the data and move the prior alone. Which features of the posterior change quickly, and which are almost untouched after 100 trials?
3. Set the true probability near 0 or 1. Why does the posterior stay skewed for far longer there than near 0.5?

## Assumptions and limitations

One probability is estimated, and it does not drift during a run. Trials are independent and identically distributed, and both facts are true by construction here rather than checked. The stream stops at 120 trials, which shows the early collapse of uncertainty but says nothing directly about asymptotic behaviour. Intervals are equal-tailed, so they need not coincide with shortest or highest-density regions, particularly for strongly skewed or U-shaped posteriors. Prior parameters are held at or above 0.5, which keeps an endpoint divergence plottable; the Jeffreys prior for this model, $\mathrm{Beta}(1/2,1/2)$, sits exactly at that limit (Jeffreys 1946).
