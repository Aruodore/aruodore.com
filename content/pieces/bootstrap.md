---
title: The Bootstrap
slug: bootstrap
published: 2026-09-29
modified: 2026-09-29
version: 1.0.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/bootstrap
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'The Bootstrap: Resampling, Sampling Distributions, and Uncertainty'
summary: Resampling one observed dataset with replacement builds an empirical sampling distribution, one bootstrap replicate at a time.
learning_objectives:
  - Read the empirical distribution as a probability model supported on the observed values.
  - Follow how sampling with replacement creates one bootstrap replicate.
  - Connect repeated bootstrap statistics to an estimated sampling distribution and standard error.
  - Distinguish a frequentist percentile interval from a Bayesian posterior credible interval.
limitations:
  - The interactive bootstraps the sample mean from independent, identically distributed observations.
  - The displayed percentile interval is simple and intuitive, but it is not corrected for bias or skewness.
  - Resampling observations independently is inappropriate when dependence, clustering, or survey design matters.
math_topics:
  - nonparametric bootstrap
  - empirical distributions
  - sampling distributions
  - confidence intervals
techniques:
  - Canvas 2D
  - seeded pseudorandom generator
  - Monte Carlo resampling
references:
  - kind: paper
    author: Efron, B.
    title: 'Bootstrap methods: another look at the jackknife'
    year: 1979
    venue: The Annals of Statistics
    volume: '7'
    issue: '1'
    pages: 1-26
    url: https://doi.org/10.1214/aos/1176344552
    doi: 10.1214/aos/1176344552
  - kind: book
    author: Efron, B. and Tibshirani, R.
    title: An Introduction to the Bootstrap
    year: 1993
    venue: Chapman & Hall
    isbn: 9780412042317
  - kind: book
    author: Davison, A. and Hinkley, D.
    title: Bootstrap Methods and Their Application
    year: 1997
    venue: Cambridge University Press
    url: https://doi.org/10.1017/CBO9780511802843
    doi: 10.1017/CBO9780511802843
preview_image: /pieces/bootstrap/preview.svg
social_image: /pieces/bootstrap/social-card.png
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/pieces/bootstrap/simulation.ts
downloads:
  - label: Bootstrap figure
    url: /pieces/bootstrap/preview.svg
    format: SVG
    description: Static fallback and slide-ready figure
---

::bootstrap
::

## What is this?

The orange marks are one observed sample of positive, right-skewed measurements. The browser treats those observations as an empirical population. To make one bootstrap replicate, it draws the same number of values from that population **with replacement**. A value can be selected several times, while another can be omitted.

The navy marks show the current resample. Its mean contributes one count to the histogram. Repeating the procedure produces an empirical distribution of sample means, built without assuming that the population itself is Gaussian.

## What is the math?

Given observations $x_1,\ldots,x_n$, assign probability $1/n$ to each observed value. This defines the empirical distribution

$$
\widehat F_n(x)=\frac{1}{n}\sum_{i=1}^n \mathbf 1\{x_i\leq x\}.
$$

A bootstrap sample $X_1^*,\ldots,X_n^*$ consists of independent draws from $\widehat F_n$. For the sample mean, one replicate is

$$
\bar X^*=\frac{1}{n}\sum_{i=1}^n X_i^*.
$$

After $B$ repetitions, the values $\bar X_1^*,\ldots,\bar X_B^*$ approximate the conditional distribution of the mean under the empirical model. Their standard deviation estimates the standard error of the original sample mean:

$$
\widehat{\operatorname{se}}_{\mathrm{boot}}(\bar X)
=\left[\frac{1}{B-1}\sum_{b=1}^B
\left(\bar X_b^*-\overline{\bar X^*}\right)^2\right]^{1/2}.
$$

The interval shown in the figure uses the 2.5% and 97.5% quantiles of the bootstrap replicates. It is therefore a 95% percentile bootstrap interval.

## Why is it interesting?

The bootstrap substitutes computation for a difficult sampling-distribution calculation. Once a statistic can be evaluated on a dataset, the same resampling recipe can often estimate its variability even when an analytic standard error is awkward (Efron 1979; Efron and Tibshirani 1993).

The substitution is specific: the unknown population distribution is replaced by the observed empirical distribution. It is not a posterior distribution, and the percentile endpoints are not posterior credible limits. The randomness in the figure comes from repeatedly asking what the statistic would look like if the empirical distribution were the population.

That convenience does not remove assumptions. Independent resampling preserves neither temporal dependence nor clusters. Small samples may represent the tails poorly, and nonsmooth statistics or parameters near a boundary can require better interval constructions. Block, cluster, parametric, and bias-corrected bootstraps modify the basic procedure for such settings (Davison and Hinkley 1997).

## How was it built?

A seeded generator first creates the fixed orange sample. A second seed drives the bootstrap draws, so replaying resampling holds the data fixed while reproducing the same Monte Carlo sequence. Changing the sample size or requesting new data rebuilds the empirical distribution.

The canvas keeps at most 2,000 replicate means. It redraws a bounded thirty-bin histogram, pauses while off-screen or while the document is hidden, and leaves a static SVG in place until motion preferences are known. Visitors who prefer reduced motion can start the resampling explicitly.

## Questions to try

1. At the default $n=24$, how many distinct observations usually appear in a resample of size 24?
2. Increase $n$. How does the width of the bootstrap distribution change?
3. Keep the observed sample fixed and replay the resampling. Which features are Monte Carlo noise, and which belong to the data?

## Assumptions and limitations

The observations are treated as independent and identically distributed. The example uses a sample mean, for which the bootstrap behaves especially cleanly. The 95% interval is the basic percentile construction: it is readable in a live figure, but more refined intervals can correct for bias and acceleration. The bootstrap describes uncertainty relative to the observed empirical distribution; it cannot recover parts of the population that the sample never represented.
