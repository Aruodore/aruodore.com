<script setup lang="ts">
import InferenceFigure from './inference-figure.vue'
import { DEFAULT_SETTINGS, type Settings } from '~/pieces/variational-inference/model'
import { createView } from '~/pieces/variational-inference/figure'
import type { Definition } from '~/pieces/inference/types'
const definition: Definition = {
  slug: 'variational-inference',
  title: 'Variational Inference',
  alt: 'Solid navy contours show a correlated Gaussian target; dashed navy contours show an independent Gaussian approximation. The grey path records mean iterates. The marginal panel compares first-coordinate uncertainty. The lower plot compares KL divergence with the best value in this family. Contours have radii one and two, rather than 95% probability content.',
  defaults: { ...DEFAULT_SETTINGS },
  duration: 1100,
  stepLabel: 'Fit next sweep',
  playKey: 'iteration',
  controls: [
    { key: 'iteration', label: 'Coordinate sweeps', min: 0, max: 40, step: 1 },
    { key: 'correlation', label: 'Target correlation ρ', min: 0, max: 0.95, step: 0.05, digits: 2 },
    { key: 'rate', advanced: true, label: 'Step fraction α', min: 0.1, max: 1, step: 0.1, digits: 1 },
  ],
  compute: (settings) => createView(settings as unknown as Settings),
}
</script>
<template><inference-figure :definition="definition" /></template>
