<script setup lang="ts">
import InferenceFigure from './inference-figure.vue'
import { DEFAULT_SETTINGS, type Settings } from '~/pieces/particle-filtering/model'
import { createView } from '~/pieces/particle-filtering/figure'
import type { Definition } from '~/pieces/inference/types'
const definition: Definition = {
  slug: 'particle-filtering',
  title: 'Particle Filtering',
  alt: 'Teal prediction is reweighted by the orange scaled likelihood to give the navy filtering density. The ancestry fan links weighted parents to their actual copies; spacing represents rank by state. Faint parents received no offspring.',
  defaults: { ...DEFAULT_SETTINGS },
  duration: 2400,
  presets: [
    { label: 'Reset weight-collapse example', settings: { ...DEFAULT_SETTINGS, inspect: 8 } },
    { label: 'See its offspring at step 9', settings: { inspect: 9 } },
  ],
  stepLabel: 'Run next update',
  playKey: 'inspect',
  controls: [
    { key: 'inspect', label: 'Inspect update', min: 0, max: 30, step: 1 },
    { key: 'particles', label: 'Particle count', min: 32, max: 512, step: 32 },
    {
      key: 'processNoise',
      advanced: true,
      label: 'Process noise standard deviation',
      min: 1,
      max: 6,
      step: 0.5,
      digits: 1,
    },
    {
      key: 'sensorNoise',
      advanced: true,
      label: 'Sensor noise standard deviation',
      min: 0.5,
      max: 5,
      step: 0.5,
      digits: 1,
    },
    {
      key: 'threshold',
      advanced: true,
      label: 'Resampling threshold as fraction of N',
      min: 0,
      max: 1,
      step: 0.1,
      digits: 1,
    },
  ],
  compute: (settings) => createView(settings as unknown as Settings),
}
</script>
<template><inference-figure :definition="definition" /></template>
