---
title: Particle Filtering
slug: particle-filtering
published: 2026-11-17
modified: 2026-11-17
version: 1.0.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/particle-filtering
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'Particle Filtering: Weights, Resampling, and Missing Modes'
summary: 'A cloud of weighted particles follows a nonlinear hidden state, making sensor ambiguity, effective sample size, and resampling visible.'
learning_objectives:
  - 'Follow a bootstrap particle filter through prediction, weighting, and resampling.'
  - 'Read multiple plausible states from a weighted particle distribution.'
  - 'Distinguish weight degeneracy from diversity lost through resampling.'
  - 'Interpret effective sample size as a weight diagnostic rather than a count of independent draws.'
limitations:
  - 'Only a scalar nonlinear state with known Gaussian noise is estimated.'
  - 'Finite particles can miss plausible regions of the posterior.'
  - 'The likelihood curve is rescaled for comparison with the density estimates.'
math_topics: ['Particle filtering', 'sequential Monte Carlo', 'importance sampling', 'resampling']
techniques: [SVG, seeded simulation, small dense matrix algebra]
references:
  - kind: 'paper'
    author: 'Gordon, N. J., Salmond, D. J. and Smith, A. F. M.'
    title: 'Novel approach to nonlinear/non-Gaussian Bayesian state estimation'
    year: 1993
    venue: 'IEE Proceedings F'
    volume: '140'
    issue: '2'
    pages: '107-113'
    doi: '10.1049/ip-f-2.1993.0015'
    url: 'https://doi.org/10.1049/ip-f-2.1993.0015'
  - kind: 'book'
    author: 'Särkkä, S. and Svensson, L.'
    title: 'Bayesian Filtering and Smoothing'
    year: 2023
    venue: 'Cambridge University Press'
    locator: 'Second edition, Chapter 11'
    url: 'https://users.aalto.fi/~ssarkka/pub/bfs_book_2023_online.pdf'
preview_image: /pieces/particle-filtering/preview.svg
preview_video: /pieces/particle-filtering/preview.webm
social_image: /pieces/particle-filtering/social-card.png
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/pieces/particle-filtering/model.ts
downloads:
  - label: Particle Filtering figure
    url: /pieces/particle-filtering/preview.svg
    format: SVG
    description: Static figure generated with the interactive model
---

::particle-filtering
::

## What is this?

At step 8 in the opening example, a new reading leaves the 160-particle cloud with an effective sample size of about 4.7. The next prediction receives 160 children from only 17 distinct parents. The opening view shows those copies at step 9.

The upper panel follows a single update. Teal is the predicted density, orange is the measurement likelihood scaled for visibility, and navy is the filtering density after reweighting. The sensor observes a noisy version of the state's square, so the likelihood can support both signs of the state. The dots along the baseline are individual particle positions; a large cloud can still place almost all its weight on a few of them.

The lower diagram separates parent diversity from particle count. Its upper row contains the previous weighted cloud, ordered by state. Its lower row contains the children used for the current prediction. A parent with many outgoing links has been copied repeatedly; faint parents received no children. Horizontal spacing in this diagram represents rank, not state distance.

Use **Reset weight-collapse example** to inspect step 8, then **Run next update** to see selection, prediction, and weighting in order. Resampling creates copies, process noise separates their predicted positions, and the next reading changes their weights. The particle-count control changes the Monte Carlo approximation. Noise scales and the resampling threshold are under **Model settings**.

## What is the math?

The scalar state follows the nonlinear growth model used in the particle-filtering literature (Gordon et al. 1993). Define

$$
a(x)=0.5x+\frac{25x}{1+x^2}.
$$

For steps $k=1,\ldots,30$,

$$
x_k=a(x_{k-1})+8\cos(1.2k)+v_k,
$$

with independent $v_k\sim\mathcal N(0,q^2)$. The sensor is

$$
z_k=x_k^2/20+e_k,
\qquad e_k\sim\mathcal N(0,r^2).
$$

The initial state has prior $x_0\sim\mathcal N(0,5^2)$. The initial particle cloud is an independent sample from that prior, then weighted by the first observation.

At step $k-1$, particles $x_{k-1}^{(i)}$ and normalised weights $w_{k-1}^{(i)}$ approximate the filtering distribution. A bootstrap proposal draws each new particle from the transition model. If the previous cloud has not been resampled, the new unnormalised weight is

$$
\widetilde w_k^{(i)}
=w_{k-1}^{(i)}p(z_k\mid x_k^{(i)}),
$$

where the likelihood is Gaussian around $(x_k^{(i)})^2/20$. Normalisation divides every weight by their sum. If resampling occurred before prediction, each inherited weight is instead $1/N$ (Särkkä and Svensson 2023).

The displayed effective sample size is

$$
N_{\mathrm{eff}}=\frac{1}{\sum_i(w_k^{(i)})^2}.
$$

It equals $N$ for equal weights and approaches one when a single particle holds nearly all the mass. When it falls below the selected fraction of $N$, systematic resampling chooses parent indices for the next prediction. Likely parents may be copied several times and unlikely ones omitted. The resulting children begin with equal inherited weights, then receive independent process disturbances.

## Why is it interesting?

A mean can be a poor summary of what the sensor has established. If the state is plausibly near either $-10$ or $10$, its mean may lie near zero even though zero predicts a very different reading. The density panel preserves those alternatives. A particle filter can carry both branches until the motion model and later readings distinguish them.

Its failure mode differs from that of the [extended Kalman filter](/pieces/extended-kalman-filtering), which replaces the sensor with its tangent and keeps a single Gaussian. A particle method can represent a complicated distribution, but only where its particles are. With a small cloud, a plausible branch can receive too few representatives before an informative reading arrives. Updating weights cannot recover a region containing no particles. Later process noise may repopulate it, but the lost probability is not automatically restored.

Resampling addresses weight degeneracy by concentrating computation on particles that currently matter. It also removes diversity. An effective sample size near $N$ immediately after resampling does not mean there are $N$ independent explanations: several particles may share the same parent. Raise the resampling threshold and watch how often copying is triggered. Lower it to zero and watch a small number of weights come to dominate instead.

This is the sequential counterpart of importance sampling. Each observation changes which states deserve computational effort, and the filter keeps reallocating a finite population as the record grows. A dense cloud is not necessarily a diverse one, and the figure keeps the two apart.

## How was it built?

Separate seeded streams generate the hidden record and the filter's particles. Changing the particle count or resampling threshold therefore preserves the observations. Changing either noise standard deviation regenerates the record with that noise and gives the filter the matching value. The controls investigate Monte Carlo behaviour under a known model, rather than unknown noise parameters.

Weights are calculated on the log scale and normalised after subtracting the largest log weight. Systematic resampling uses one uniform offset across equally spaced cumulative-probability thresholds. The selected update is displayed before its resampling decision is applied, so the reported ESS describes the weighted cloud shown in the figure.

The density curves use linear binning on a shared state grid, splitting each particle's mass between neighbouring bins. The orange likelihood is scaled for visibility and is not a third normalised density. All particles enter inference and the histograms; the moving rug shows at most 128 positions on desktop and 64 on mobile. Every parent and child enters the ancestry diagram, whose links are taken directly from the recorded parent indices.

During an update, the ancestry fan first separates the selected copies from their weighted parents. Particles then move from those parents to their predicted states. That transport illustrates a discrete proposal, rather than additional continuous-time dynamics. During the weighting phase the likelihood is raised to a power that increases from zero to one. The density ceiling is fixed across the episode so changes in the curves do not come from a changing vertical scale. A single step pauses after the update; continuous playback stops at the end of the record. Both pause off-screen and in hidden tabs, and reduced motion retains a static fallback until explicitly started.

## Questions to try

1. Reset the opening example at step 8 and advance to step 9. How can 160 children come from only 17 distinct parents?
2. Reduce the particle count and draw several noise samples. Does the cloud always retain both plausible signs?
3. Set the resampling threshold to zero. How many particles carry most of the probability after several updates?
4. Raise the threshold to one. Does frequent resampling guarantee a diverse set of ancestors?

## Assumptions and limitations

The transition, sensor, and Gaussian noise scales are known, and every observation is associated with the same scalar process. The finite cloud and binned density plots are approximations, with no guarantee that every plausible branch is represented. The displayed state range can clip tail particles; inference still uses their full values. Effective sample size diagnoses unequal weights, not independent information or calibrated posterior accuracy. The bootstrap proposal ignores the next reading when placing particles, which can waste most of a cloud when the sensor is very informative. More sophisticated proposals and particle methods address that difficulty at additional computational cost.
