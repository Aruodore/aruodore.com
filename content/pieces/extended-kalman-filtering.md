---
title: Extended Kalman Filtering
slug: extended-kalman-filtering
published: 2026-10-27
modified: 2026-10-29
version: 1.1.0
author: Lucas Aruodore Adomi
canonical_url: https://aruodore.com/pieces/extended-kalman-filtering
license_url: https://creativecommons.org/licenses/by/4.0/
citation_title: 'Extended Kalman Filtering: A Tangent to a Nonlinear Sensor'
summary: 'A pendulum swings beyond the small-angle regime: local linearisation tracks its hidden angle, while a tangent to the sensor reveals where Gaussian updates lose information.'
learning_objectives:
  - Distinguish a nonlinear state prediction from propagation of its covariance through a Jacobian.
  - Read the measurement Jacobian as local sensor sensitivity.
  - Compare an extended Kalman filter with a fixed small-angle approximation on the same observations.
  - Recognise ambiguity and overconfidence that a single Gaussian cannot resolve.
limitations:
  - The state is an unwrapped angle and angular velocity, not a probability distribution on a circle.
  - The simulation uses a discrete pendulum model rather than an exact continuous-time solution.
  - Gaussian intervals are approximate and can be misleading near sensor turning points.
math_topics: [Extended Kalman filter, nonlinear state-space models, Jacobians, Gaussian approximation]
techniques: [SVG, seeded simulation, Joseph covariance update]
references:
  - kind: book
    author: Särkkä, S. and Svensson, L.
    title: Bayesian Filtering and Smoothing
    year: 2023
    venue: Cambridge University Press
    locator: 'Second edition, Chapter 7'
    url: https://www.cambridge.org/core/books/abs/bayesian-filtering-and-smoothing/extended-kalman-filtering/AB8C7D1BF35C061F2136BBB7792F5D6C
  - kind: book
    author: Murphy, K. P.
    title: 'Probabilistic Machine Learning: Advanced Topics'
    year: 2023
    venue: MIT Press
    url: https://probml.github.io/pml-book/book2.html
preview_image: /pieces/extended-kalman-filtering/preview.svg
preview_video: /pieces/extended-kalman-filtering/preview.webm
social_image: /pieces/extended-kalman-filtering/social-card.png
source_url: https://github.com/Aruodore/aruodore.com
source_file_url: https://github.com/Aruodore/aruodore.com/blob/main/pieces/extended-kalman-filtering/model.ts
downloads:
  - label: Nonlinear tracking and sensor linearisation
    url: /pieces/extended-kalman-filtering/preview.svg
    format: SVG
    description: Static comparison generated from the same model as the interactive
---

::extended-kalman-filtering
::

## What is this?

The grey line is the angle of a swinging pendulum. A sensor sees only the bob's horizontal position, with noise, and the two navy lines estimate the hidden angle from those readings. The solid line is an extended Kalman filter (EKF). The dashed line is an ordinary Kalman filter using the small-angle approximation. Both start from the same belief and receive exactly the same data.

Near the downward vertical, horizontal position is almost proportional to angle, and the two filters have similar models. At larger angles that relationship bends. The EKF follows the nonlinear motion and sensor curves, while the small-angle filter continues to treat them as straight lines. The shaded navy band is the EKF's approximate 95% interval for angle.

The lower panel shows the sensor curve, $\sin\theta$, and the orange reading selected by the time slider. The teal line is the tangent the EKF uses for that update, drawn across its predicted angle interval. Move the inspection slider to pause and compare the tangent with the curve. Where they separate, the filter's local approximation is being asked to describe more than the slope at one point.

## What is the math?

The state is $x=(\theta,\omega)^\top$: angle from the downward vertical and angular velocity. A pendulum has acceleration $\dot\omega=-(g/L)\sin\theta$. With $g/L=4$ seconds$^{-2}$ and a timestep $\Delta=0.05$ seconds, the figure advances velocity first, then position:

$$
\begin{aligned}
\omega'&=\omega-4\Delta\sin\theta,\\
f(x)&=\begin{pmatrix}\theta+\Delta\omega'\\\omega'\end{pmatrix}.
\end{aligned}
$$

The state evolves as $x_{k+1}=f(x_k)+w_k$, with independent Gaussian disturbances of covariance $Q=\operatorname{diag}(0.002^2,0.015^2)$ per step. The sensor reports horizontal displacement in units of rod length,

$$
\begin{aligned}
z&=h(x)+e=\sin\theta+e,\\
e&\sim\mathcal N(0,r^2).
\end{aligned}
$$

A nonlinear transformation of a Gaussian is generally not Gaussian. The EKF keeps the mean and covariance representation by replacing each transformation locally with its tangent (Särkkä and Svensson 2023). From a filtered mean $m$ and covariance $P$, prediction gives

$$
m^-=f(m),\qquad P^-=FPF^\top+Q,
$$

where the transition Jacobian is evaluated at $m$:

$$
F=\begin{pmatrix}1-4\Delta^2\cos m_\theta&\Delta\\-4\Delta\cos m_\theta&1\end{pmatrix}.
$$

The mean follows the nonlinear step, while covariance follows the derivative. Even the mean is approximate: $f(\mathbb E[x])$ need not equal $\mathbb E[f(x)]$.

For the sensor update, the tangent is taken at the new predicted mean,

$$
h(\theta)\approx\sin m^-_\theta+\cos m^-_\theta(\theta-m^-_\theta).
$$

The sensor Jacobian is $H=(\cos m^-_\theta,0)$. With $R=r^2$, Gaussian conditioning on that approximation gives

$$
S=HP^-H^\top+R,\qquad K=P^-H^\top/S,
$$

$$
\begin{aligned}
m^+&=m^-+K(z-\sin m^-_\theta),\\
P^+&=(I-KH)P^-.
\end{aligned}
$$

The innovation $z-\sin m^-_\theta$ compares the reading with the nonlinear sensor prediction. The gain converts that discrepancy into angle and velocity corrections. As in the [linear filtering piece](/pieces/kalman-filtering), velocity is learned through its covariance with position, although it is never measured directly.

The small-angle filter replaces $\sin\theta$ by $\theta$ in both dynamics and sensing. Its transition is $f_0(x)=(\theta+\Delta(\omega-4\Delta\theta),\omega-4\Delta\theta)^\top$, and its sensor is $h_0(x)=\theta$. Its Jacobians are constant, so it is an exact Kalman filter for that approximate model.

## Why is it interesting?

The small-angle approximation has a visible range of usefulness. At a release angle of 0.3 radians, both filters track closely: over the default twelve-second noise record, the EKF's angle root-mean-square error is about 0.023 radians and the small-angle filter's is about 0.021. At 1.5 radians the errors are about 0.034 and 0.43; at 2.4 they are about 0.042 and 1.35. These are comparisons on one seeded record, but they show what changes as the same linear approximation is carried further from zero.

The EKF's own approximation has a limit too. Near a horizontal rod, $\cos\theta$ approaches zero and the sensor tangent flattens. At a predicted angle of exactly $\pi/2$, $H=0$ and the gain is zero: the EKF ignores the reading. Yet the curved sensor can still carry information. A reading below the peak may support angles on either side of it, since $\sin\theta=\sin(\pi-\theta)$. The first derivative misses that structure completely.

Increase the initial uncertainty and compare the teal segment with the curve across its full width. A tangent that is accurate at the mean can be poor over much of the predicted distribution. Depending on the prior and sensor noise, the posterior can put substantial probability on separate angle branches. One Gaussian has no way to retain both as distinct alternatives. Earlier observations and the motion model help select a branch, but a narrow band can still follow the wrong one.

This is the tradeoff behind the EKF: the small state and covariance make nonlinear tracking inexpensive, at the cost of a local Gaussian approximation (Murphy 2023). The figure exposes that approximation at each update rather than only showing the resulting trajectory. Low error on a record and a well-behaved covariance are useful checks, but neither tells us whether the interval describes the uncertainty faithfully.

## How was it built?

The simulated pendulum and the EKF use the same discrete transition and process noise. Both filters start at rest with angle mean 0.25 radians above the selected release angle, angle standard deviation set by the slider, and velocity standard deviation 0.3 radians per second. This gives them approximate knowledge of the starting angle before any reading arrives. Covariances are stored as three entries of a symmetric two-by-two matrix. The update uses Joseph form, $P^+=(I-KH)P^-(I-KH)^\top+KRK^\top$, to preserve symmetry and positive semidefiniteness numerically.

A seeded generator supplies process and sensor disturbances. Changing initial uncertainty preserves the path and readings; changing sensor noise scales the same standard-normal draws and changes the assumed $r$ to match. **New noise sample** replaces both sets of disturbances. The reported errors cover updated angles from the first measurement at 0.05 seconds through the inspected time, reaching 240 updates at 12 seconds.

The SVG opens four seconds into the record and reveals subsequent estimates while the tangent follows each prediction. Each estimate uses only the readings through its own time. At the end, playback holds briefly and repeats the same record. The figure pauses off-screen and in hidden tabs, and visitors who prefer reduced motion can start it explicitly.

## Questions to try

1. Change the release angle from 0.3 to 1.5 and then 2.4 radians. Where does the small-angle filter lose the trajectory?
2. At a release angle of 1.5, inspect the first reading. Why is the local sensor slope negative even though the release angle is below $\pi/2$?
3. Increase initial uncertainty. How well does the tangent describe the sensor across the teal interval?
4. At a release angle of 2.4, try several noise samples. Can the EKF's band become narrow while missing the true angle?

## Assumptions and limitations

The dynamics are a discrete pendulum approximation with known parameters and additive Gaussian noise. The EKF is given the correct transition and noise levels; unknown physical parameters would introduce another source of error. Angles are unwrapped real values, rather than a distribution on a circle. The band $m_\theta\pm1.96\sqrt{P_{\theta\theta}}$ is a pointwise Gaussian approximation, so its nominal 95% is not a coverage guarantee for the nonlinear posterior. A single Gaussian cannot preserve separate angle branches, and the shared initial belief assumes some knowledge of the release setting. After initialisation, the hidden trajectory is used only for drawing and error reporting.
