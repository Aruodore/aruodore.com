---
title: Kalman Filtering
slug: kalman-filtering
published: 2026-10-25
modified: 2026-10-25
version: 1.0.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/kalman-filtering
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'Kalman Filtering: Prediction, Correction, and Occlusion'
summary: 'A Kalman filter alternates prediction with Gaussian conditioning on noisy measurements: its belief about a hidden object widens behind an occluder and tightens when measurements resume.'
learning_objectives:
  - Read the Kalman filter as repeated Bayesian updating of a Gaussian belief, with a prediction step between measurements.
  - Compute the predict and update equations for a constant-velocity model and interpret the Kalman gain.
  - See why a velocity that is never measured can still be inferred from successive positions.
  - Use the normalised innovation squared to check whether the assumed noise levels are consistent with the data.
limitations:
  - The filter assumes constant velocity with Gaussian acceleration noise. The hidden object follows a smooth curved path that does not come from this model.
  - Process noise and measurement noise are set by hand. Measurement noise along y is fixed at twice the value along x.
  - The figure follows one object with no clutter, missed detections other than the occluder, or data association.
  - The filter uses only past measurements. A smoother that also uses later ones would give tighter estimates behind the occluder.
math_topics:
  - Kalman filter
  - Gaussian conditioning
  - state-space models
  - Bayesian filtering
techniques:
  - Canvas 2D
  - small dense matrix algebra
  - seeded pseudorandom generator
references:
  - kind: paper
    author: Kalman, R.
    title: A new approach to linear filtering and prediction problems
    year: 1960
    venue: Journal of Basic Engineering
    volume: '82'
    issue: '1'
    pages: 35-45
    url: https://doi.org/10.1115/1.3662552
    doi: 10.1115/1.3662552
  - kind: book
    author: Bar-Shalom, Y., Li, X. and Kirubarajan, T.
    title: Estimation with Applications to Tracking and Navigation
    year: 2001
    venue: Wiley
  - kind: book
    author: Särkkä, S.
    title: Bayesian Filtering and Smoothing
    year: 2013
    venue: Cambridge University Press
    url: https://doi.org/10.1017/CBO9781139344203
    doi: 10.1017/CBO9781139344203
  - kind: paper
    author: Bewley, A. et al.
    title: Simple online and realtime tracking
    year: 2016
    venue: IEEE International Conference on Image Processing
    pages: 3464-3468
    url: https://arxiv.org/abs/1602.00763
    doi: 10.1109/ICIP.2016.7533003
preview_image: /pieces/kalman-filtering/preview.svg
social_image: /pieces/kalman-filtering/social-card.png
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/pieces/kalman-filtering/model.ts
downloads:
  - label: Kalman filter figure
    url: /pieces/kalman-filtering/preview.svg
    format: SVG
    description: Static fallback and slide-ready figure
---

::kalman-filtering
::

## What is this?

An object moves along a curved path that the filter cannot see. At every step a sensor reports its position with noise, shown as an orange dot. The grey line is where the object actually went. The filter's job is to estimate where the object is, and how fast it is moving, from the dots alone.

Each step has two parts. First the filter predicts: given its current belief, where should the object be now? That is the teal ellipse, the prior for this step. Then it corrects: the new measurement is combined with the prediction, giving the navy ellipse, the posterior. Both ellipses are 95% regions for the position. The navy arrow is the estimated velocity, which the sensor never reports.

The shaded band is an occluder. While the object is behind it there are no measurements, so there is nothing to correct with, and the navy ellipse grows at every step. When the object reappears, a single measurement shrinks it again. The opening frame shows that moment: the wide teal prior is the prediction made after the gap, and the small navy posterior is that prediction combined with the first new measurement.

## What is the math?

The state is $\mathbf x = (p_x, p_y, v_x, v_y)$: position and velocity. The filter assumes that velocity changes only by small random kicks,

$$
\mathbf x_k = F \mathbf x_{k-1} + \mathbf w_k, \qquad \mathbf w_k \sim \mathcal N(0, Q),
$$

where $F$ adds $\Delta t \cdot v$ to each position, with $\Delta t = 0.1$. The sensor sees only position, with independent Gaussian errors:

$$
\mathbf z_k = H \mathbf x_k + \mathbf e_k, \qquad \mathbf e_k \sim \mathcal N(0, R),
$$

where $H$ picks out $(p_x, p_y)$ and $R = \operatorname{diag}(r^2, (2r)^2)$. The slider for $q$ sets the size of $Q$ and the slider for $r$ sets $R$.

Because both models are linear and Gaussian, the belief about $\mathbf x_k$ given all measurements so far is Gaussian, $\mathcal N(\mathbf m_k, P_k)$, and the filter only has to track a mean and a covariance. Prediction pushes the previous belief through the dynamics:

$$
\mathbf m_k^- = F \mathbf m_{k-1}, \qquad P_k^- = F P_{k-1} F^\top + Q.
$$

The update is Bayes' rule with a Gaussian prior and a Gaussian likelihood. With the innovation $\mathbf y_k = \mathbf z_k - H \mathbf m_k^-$ and its covariance $S_k = H P_k^- H^\top + R$,

$$
K_k = P_k^- H^\top S_k^{-1}, \qquad \mathbf m_k = \mathbf m_k^- + K_k \mathbf y_k, \qquad P_k = (I - K_k H) P_k^- .
$$

For one coordinate with prior variance $P^-$ and measurement variance $r^2$, the gain is $K = P^- / (P^- + r^2)$: the posterior mean is $(1 - K)\,m^- + K z$ and its variance is $(1 - K) P^-$. A confident prediction gives a small gain and the measurement barely moves the estimate. A vague prediction gives a gain near 1 and the estimate follows the measurement. Position and velocity are correlated in $P_k^-$, which is how a position measurement also corrects the velocity.

The panel reports the mean of the normalised innovation squared (NIS), $\mathbf y_k^\top S_k^{-1} \mathbf y_k$. If the model is correct it follows a $\chi^2$ distribution with two degrees of freedom, so its long-run mean is 2. A mean well above 2 means the measurements surprise the filter more than it expects, because $r$ or $q$ is too small for the real noise and motion. A mean well below 2 means the filter is more cautious than the data require.

## Why is it interesting?

The filter is one of the most widely used examples of recursive Bayesian inference (Kalman 1960). The same operation of conditioning a joint Gaussian runs through the [Gaussian process regression](/pieces/gaussian-process-regression) piece, where it acts on a function. Here it acts on a state that is revised one measurement at a time, and old measurements never need to be revisited. The textbook treatments are Bar-Shalom et al. (2001) for tracking and Särkkä (2013) for the Bayesian view.

The same setting appears in computer vision. A detector reports a box in each video frame, with jitter and the occasional miss. Some online trackers smooth those boxes with a constant-velocity Kalman filter and use its prediction to match detections to objects from frame to frame (Bewley et al. 2016). The occluder in the figure is that situation in miniature: a person walks behind a pillar, the detector goes quiet, and the tracker has to carry the object across the gap.

The figure shows three things that are easy to lose in the equations. The arrow is a velocity the sensor never reports, recovered from successive positions. The ellipse is part of the filter's output, and it grows exactly when information is missing. And the estimate is more accurate than the measurements it is built from. Over a 3000-step run with the default settings and the occluder off, the filter's root-mean-square position error is about 0.19, against about 0.34 for the raw measurements. With the occluder on, the filter's error is about 0.28: still smaller than the measurements' 0.34, but by less, because the prediction drifts while the object is hidden.

## How was it built?

The model in `pieces/kalman-filtering/model.ts` is a direct transcription of the equations above with small dense matrices stored as row-major arrays. The covariance update uses the Joseph form, $P = (I - KH) P^- (I - KH)^\top + K R K^\top$, which equals the expression above in exact arithmetic but stays symmetric and positive semidefinite in floating point. The process covariance $Q$ is the discrete white-noise acceleration model: acceleration of intensity $q$ integrated over $\Delta t$ gives, for each axis, $q^2$ times $\left[\begin{smallmatrix} \Delta t^3/3 & \Delta t^2/2 \\ \Delta t^2/2 & \Delta t \end{smallmatrix}\right]$.

The hidden path is a sum of two sinusoids, so the object keeps accelerating, with a peak acceleration of about 0.8 along each axis. The filter's constant-velocity model is therefore always slightly wrong, so $q$ has to be large enough to absorb that error. The measurement noise is drawn from a seeded generator, and two normal draws are consumed at every step whether or not the object is occluded, so switching the occluder does not change the noise at any step.

Each ellipse is the 95% region of the position marginal: with position covariance eigenvalues $\lambda_1, \lambda_2$, its semi-axes are $\sqrt{c \lambda_i}$ with $c = -2 \ln 0.05 \approx 5.99$, the 95% point of $\chi^2_2$. The canvas pauses while off-screen or while the document is hidden, and the static figure stays in place until motion preferences are known. Visitors who prefer reduced motion can start the figure explicitly.

## Questions to try

1. Switch the occluder off. How do the filter and measurement errors compare, and what does the mean NIS do?
2. With the occluder on, lower $q$ to 0.05. How does the ellipse grow behind the occluder, and where is the object when it comes out?
3. Raise $r$ to 1, much larger than the true 0.15. Is the estimated path smoother or rougher, and does it lag the true path on bends?
4. Restart the tracker and watch the first ten steps. How do the ellipse and the velocity arrow change as the filter sees more positions?

## Assumptions and limitations

The filter assumes linear dynamics and measurements with Gaussian noise, which is what makes the belief exactly Gaussian. The hidden path is not generated by the filter's model, so the figure shows the filter working under mild misspecification: the mean normalised innovation squared sits slightly above 2 at the default settings, about 2.1 over a long run, and the 95% ellipse contains the true position about 95% of the time only because $q$ is set high enough to absorb the unmodelled acceleration. Lower $q$ and the coverage falls. Process and measurement noise are fixed by the sliders, not estimated. The figure follows a single object and assumes every measurement belongs to it, an assumption real trackers cannot make. Nonlinear sensors and dynamics need extensions such as the extended or unscented Kalman filter, or particle filters.
