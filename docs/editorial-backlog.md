# Editorial backlog

The agreed sequence following Kalman filtering (2026-10-25):

1. **Kalman smoothing.** Implemented locally for 2026-10-27. A fixed-interval RTS smoother compares filtering and smoothing across a measurement gap, with a movable evidence cutoff.
2. **Extended Kalman filtering.** Implemented locally for 2026-10-27. A nonlinear pendulum tracker compares the EKF with a small-angle filter and exposes the sensor tangent at each measurement.
3. **Particle filtering.** Represent uncertainty with weighted particles; make weighting, resampling, and particle depletion visible.
