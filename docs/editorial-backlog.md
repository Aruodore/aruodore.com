# Editorial backlog

The next three deep interactives after First Passage, in recommended order.

## 1. Beta-Binomial Update

Show a sequence of Bernoulli observations updating a beta prior. The prior is teal, observations are orange, and the posterior is navy. Controls set the prior parameters and the underlying data probability. The main view overlays the prior and posterior densities while a compact event strip records successes and failures.

Central ideas: conjugacy, sequential Bayesian updating, effective sample size, posterior predictive probability, and sensitivity to the prior.

Keep the first version to one unknown Bernoulli probability. Do not add model comparison or hierarchical priors yet.

## 2. Brownian Bridge

Show Brownian paths conditioned to begin and end at selected values. Let the visitor move the endpoint and compare unconditional Brownian paths with bridge paths whose uncertainty narrows to zero at the terminal time.

Central ideas: Gaussian conditioning, pinned stochastic processes, the covariance $\min(s,t)-st/T$, and connections to goodness-of-fit statistics.

Use a two-dimensional space-time plot rather than another particle cloud. Keep the first version to fixed endpoints and a fixed terminal time.

## 3. Metropolis-Hastings

Show a Markov chain exploring a difficult one-dimensional target distribution. Pair the moving chain with a trace plot and a growing empirical density. Controls change proposal scale so the visitor can see the tradeoff between rejected moves and slow local exploration.

Central ideas: detailed balance, acceptance probability, autocorrelation, effective sample size, and convergence diagnostics.

Begin with a fixed bimodal target and a Gaussian random-walk proposal. Adaptive proposals, multiple chains, and higher dimensions should be later extensions.
