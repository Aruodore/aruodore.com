<script setup lang="ts">
import InferenceFigure from './inference-figure.vue'
import { DEFAULT_SETTINGS, type Settings } from '~/pieces/bayesian-optimisation/model'
import { createView } from '~/pieces/bayesian-optimisation/figure'
import type { Definition } from '~/pieces/inference/types'
const definition: Definition = {
  slug: 'bayesian-optimisation',
  title: 'Bayesian Optimisation',
  alt: 'Orange evaluations condition a navy Gaussian process posterior. Expected improvement selects the next input. The grey objective is visible for comparison but is hidden from the acquisition rule.',
  defaults: { ...DEFAULT_SETTINGS },
  duration: 2200,
  stepLabel: 'Evaluate suggested input',
  playKey: 'iterations',
  controls: [
    { key: 'iterations', label: 'Evaluations available', min: 3, max: 18, step: 1 },
    { key: 'lengthScale', advanced: true, label: 'Kernel length scale', min: 0.3, max: 2, step: 0.1, digits: 1 },
    { key: 'exploration', advanced: true, label: 'Improvement margin ξ', min: 0, max: 0.5, step: 0.01, digits: 2 },
  ],
  compute: (settings) => createView(settings as unknown as Settings),
}
</script>
<template><inference-figure :definition="definition" /></template>
