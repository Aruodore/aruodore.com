<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '~/composables/use-reduced-motion'
import {
  averageSd,
  FIGURE_SEEDS,
  GP_LIMITS,
  gpPosterior,
  INITIAL_INPUTS,
  initialObservations,
  MAX_OBSERVATIONS,
} from '~/pieces/gaussian-process-regression/model'
import { mountGaussianProcessRegression, type GpHandle } from '~/pieces/gaussian-process-regression/simulation'

const figure = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const params = ref({ lengthScale: 1, noise: 0.2 })
const initialPosterior = gpPosterior(initialObservations(FIGURE_SEEDS.initial), params.value)
const observations = ref<number>(INITIAL_INPUTS.length)
const logMarginalLikelihood = ref(initialPosterior.logMarginalLikelihood)
const meanSd = ref(averageSd(initialPosterior))
const full = ref(false)
const started = ref(false)
const failed = ref(false)
const visible = ref(true)
const manuallyStarted = ref(false)
const pausedByUser = ref(false)
const { reduced, resolved } = useReducedMotion()
const buttonClass =
  'min-h-11 border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink enabled:hover:border-posterior enabled:active:translate-y-px disabled:cursor-default disabled:text-muted'
let handle: GpHandle | null = null
let observer: IntersectionObserver | null = null

async function start(manual = false) {
  if (manual) manuallyStarted.value = true
  started.value = true
  failed.value = false
  await nextTick()
  if (!canvas.value || handle) return
  try {
    handle = mountGaussianProcessRegression(canvas.value, {
      onStatsUpdate: (stats) => {
        observations.value = stats.observations
        logMarginalLikelihood.value = stats.logMarginalLikelihood
        meanSd.value = stats.averageSd
        full.value = stats.full
      },
    })
    handle.setParameters(params.value)
    syncPlayback()
  } catch {
    failed.value = true
    started.value = false
  }
}

function syncPlayback() {
  if (!handle) return
  if (document.hidden || !visible.value || pausedByUser.value || (reduced.value && !manuallyStarted.value))
    handle.pause()
  else handle.resume()
}

function togglePlayback() {
  pausedByUser.value = !pausedByUser.value
  syncPlayback()
}

onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      visible.value = entry?.isIntersecting ?? true
      syncPlayback()
    },
    { threshold: 0.05 },
  )
  if (figure.value) observer.observe(figure.value)
  document.addEventListener('visibilitychange', syncPlayback)
})

watch(
  resolved,
  (ready) => {
    if (ready && !reduced.value) void start()
  },
  { immediate: true },
)
watch(reduced, syncPlayback)
watch(params, (value) => handle?.setParameters(value), { deep: true })

onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('visibilitychange', syncPlayback)
  handle?.destroy()
  handle = null
})
</script>

<template>
  <figure ref="figure" aria-describedby="gp-caption" class="w-full min-w-0 max-w-full">
    <div class="rule-top rule-bottom grid min-w-0 overflow-hidden bg-bg lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div class="relative min-h-[30rem] min-w-0 bg-bg sm:min-h-[34rem]">
        <picture v-if="!started || failed" class="absolute inset-0 block h-full w-full">
          <source media="(max-width: 619px)" srcset="/pieces/gaussian-process-regression/preview-mobile.svg" />
          <img
            src="/pieces/gaussian-process-regression/preview.svg"
            width="900"
            height="600"
            alt="A teal prior band, six orange observations, and a navy posterior band that narrows near the data and widens between them."
            class="h-full w-full object-contain"
          />
        </picture>
        <canvas
          v-show="started && !failed"
          ref="canvas"
          role="img"
          aria-label="Orange observations condition a teal Gaussian process prior into a navy posterior band, with posterior sample functions drifting inside it."
          class="absolute inset-0 h-full w-full cursor-crosshair"
        />
        <button
          v-if="resolved && reduced && !started"
          type="button"
          class="absolute inset-x-0 bottom-4 mx-auto min-h-11 w-fit border border-posterior bg-bg px-4 py-2 font-sans text-xs uppercase tracking-widest text-ink active:translate-y-px"
          @click="start(true)"
        >
          Run regression
        </button>
        <p v-if="failed" class="absolute inset-x-4 bottom-4 bg-bg p-2 text-center font-sans text-xs text-muted">
          Canvas rendering is unavailable. The static figure shows the same posterior.
        </p>
      </div>

      <aside class="flex min-w-0 flex-col border-rule p-4 lg:border-l" aria-label="Gaussian process controls">
        <label class="block">
          <span class="flex items-baseline justify-between gap-3">
            <span class="font-serif italic">Length scale ℓ</span>
            <output class="font-mono text-xs tnum">{{ params.lengthScale.toFixed(1) }}</output>
          </span>
          <span class="block font-sans text-xs text-muted">How far apart inputs stay correlated.</span>
          <input
            v-model.number="params.lengthScale"
            aria-label="Kernel length scale"
            type="range"
            :min="GP_LIMITS.lengthScale.min"
            :max="GP_LIMITS.lengthScale.max"
            step="0.1"
            class="gp-range mt-2 w-full"
          />
        </label>

        <label class="mt-5 block">
          <span class="flex items-baseline justify-between gap-3">
            <span class="font-serif italic">Noise σ<sub>n</sub></span>
            <output class="font-mono text-xs tnum">{{ params.noise.toFixed(2) }}</output>
          </span>
          <span class="block font-sans text-xs text-muted">Assumed observation noise. Generated data use 0.18.</span>
          <input
            v-model.number="params.noise"
            aria-label="Observation noise standard deviation"
            type="range"
            :min="GP_LIMITS.noise.min"
            :max="GP_LIMITS.noise.max"
            step="0.01"
            class="gp-range mt-2 w-full"
          />
        </label>

        <dl class="mt-6 space-y-3 border-t border-rule pt-4 text-xs">
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Observations n</dt>
            <dd class="flex items-center gap-2 font-mono text-ink tnum">
              <span aria-hidden="true" class="inline-block size-2 rounded-full bg-observed"></span>
              {{ observations }} / {{ MAX_OBSERVATIONS }}
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Log marginal likelihood</dt>
            <dd class="font-mono text-ink tnum">{{ observations ? logMarginalLikelihood.toFixed(2) : '0.00' }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Mean posterior sd</dt>
            <dd class="font-mono text-posterior tnum">{{ meanSd.toFixed(3) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Prior sd</dt>
            <dd class="font-mono text-prior tnum">1.000</dd>
          </div>
        </dl>

        <div v-if="started && !failed" class="mt-6 grid gap-2 lg:mt-auto">
          <button type="button" :aria-pressed="pausedByUser" :class="buttonClass" @click="togglePlayback">
            {{ pausedByUser ? 'Resume samples' : 'Pause samples' }}
          </button>
          <button type="button" :disabled="full" :class="buttonClass" @click="handle?.addObservation()">
            Add observation
          </button>
          <button type="button" :disabled="observations === 0" :class="buttonClass" @click="handle?.removeLast()">
            Remove last
          </button>
          <button type="button" :disabled="observations === 0" :class="buttonClass" @click="handle?.clear()">
            Clear data
          </button>
          <button type="button" :class="buttonClass" @click="handle?.restore()">Restore initial data</button>
        </div>
      </aside>
    </div>

    <figcaption id="gp-caption" class="mt-3 max-w-[65ch] text-sm text-muted">
      The teal band is the prior 95% band for <span class="font-serif italic">f</span>(<span class="font-serif italic"
        >x</span
      >). Each orange observation pulls the navy posterior band in around it; far from the data the band relaxes back to
      the prior. Thin navy curves are whole functions drawn from the posterior.
    </figcaption>
  </figure>
</template>

<style scoped>
.gp-range {
  accent-color: var(--color-posterior);
  min-height: 2.75rem;
}
</style>
