<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '~/composables/use-reduced-motion'
import {
  DEFAULT_PARAMETERS,
  FIGURE_SEED,
  KALMAN_LIMITS,
  OPENING_STEP,
  runTracker,
  TRUE_MEASUREMENT_SD,
  trackerStats,
} from '~/pieces/kalman-filtering/model'
import { mountKalmanFiltering, type KalmanHandle } from '~/pieces/kalman-filtering/simulation'

const figure = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const params = ref({ ...DEFAULT_PARAMETERS })
const stats = ref(trackerStats(runTracker(OPENING_STEP + 1, DEFAULT_PARAMETERS, FIGURE_SEED).tracker))
const occluder = ref(true)
const started = ref(false)
const failed = ref(false)
const visible = ref(true)
const manuallyStarted = ref(false)
const pausedByUser = ref(false)
const { reduced, resolved } = useReducedMotion()
const buttonClass =
  'min-h-11 border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink enabled:hover:border-posterior enabled:active:translate-y-px disabled:cursor-default disabled:text-muted'
let handle: KalmanHandle | null = null
let observer: IntersectionObserver | null = null

async function start(manual = false) {
  if (manual) manuallyStarted.value = true
  started.value = true
  failed.value = false
  await nextTick()
  if (!canvas.value || handle) return
  try {
    handle = mountKalmanFiltering(canvas.value, { onStatsUpdate: (next) => (stats.value = next) })
    handle.setParameters(params.value)
    handle.setOccluder(occluder.value)
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
watch(occluder, (value) => handle?.setOccluder(value))

onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('visibilitychange', syncPlayback)
  handle?.destroy()
  handle = null
})
</script>

<template>
  <figure ref="figure" aria-describedby="kf-caption" class="w-full min-w-0 max-w-full">
    <div class="rule-top rule-bottom grid min-w-0 overflow-hidden bg-bg lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div class="relative min-h-[20rem] min-w-0 bg-bg sm:min-h-[34rem]">
        <picture v-if="!started || failed" class="absolute inset-0 block h-full w-full">
          <source media="(max-width: 619px)" srcset="/pieces/kalman-filtering/preview-mobile.svg" />
          <img
            src="/pieces/kalman-filtering/preview.svg"
            width="900"
            height="600"
            alt="A grey true path crosses a shaded occluder. Orange measurements stop at its edge, and the navy 95% position ellipse widens while the object is hidden."
            class="h-full w-full object-contain"
          />
        </picture>
        <canvas
          v-show="started && !failed"
          ref="canvas"
          role="img"
          aria-label="A Kalman filter tracks a hidden object from orange position measurements. A teal prior ellipse and a navy posterior ellipse show the 95% region for its position, and the navy ellipse widens while the object is behind the occluder."
          class="absolute inset-0 h-full w-full"
        />
        <button
          v-if="resolved && reduced && !started"
          type="button"
          class="absolute inset-x-0 bottom-4 mx-auto min-h-11 w-fit border border-posterior bg-bg px-4 py-2 font-sans text-xs uppercase tracking-widest text-ink active:translate-y-px"
          @click="start(true)"
        >
          Run filter
        </button>
        <p v-if="failed" class="absolute inset-x-4 bottom-4 bg-bg p-2 text-center font-sans text-xs text-muted">
          Canvas rendering is unavailable. The static figure shows the same filter.
        </p>
      </div>

      <aside class="flex min-w-0 flex-col border-rule p-4 lg:border-l" aria-label="Kalman filter controls">
        <label class="block">
          <span class="flex items-baseline justify-between gap-3">
            <span class="font-serif italic">Process noise q</span>
            <output class="font-mono text-xs tnum">{{ params.processNoise.toFixed(2) }}</output>
          </span>
          <span class="block font-sans text-xs text-muted">How freely the filter lets velocity change.</span>
          <input
            v-model.number="params.processNoise"
            aria-label="Process noise intensity"
            type="range"
            :min="KALMAN_LIMITS.processNoise.min"
            :max="KALMAN_LIMITS.processNoise.max"
            step="0.05"
            class="kf-range mt-2 w-full"
          />
        </label>

        <label class="mt-5 block">
          <span class="flex items-baseline justify-between gap-3">
            <span class="font-serif italic">Measurement noise r</span>
            <output class="font-mono text-xs tnum">{{ params.measurementNoise.toFixed(2) }}</output>
          </span>
          <span class="block font-sans text-xs text-muted"
            >Assumed sd along x; y is twice as large. Generated data use {{ TRUE_MEASUREMENT_SD.toFixed(2) }}.</span
          >
          <input
            v-model.number="params.measurementNoise"
            aria-label="Measurement noise standard deviation"
            type="range"
            :min="KALMAN_LIMITS.measurementNoise.min"
            :max="KALMAN_LIMITS.measurementNoise.max"
            step="0.05"
            class="kf-range mt-2 w-full"
          />
        </label>

        <dl class="mt-6 space-y-3 border-t border-rule pt-4 text-xs">
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Step k</dt>
            <dd class="font-mono text-ink tnum">{{ stats.step }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Filter RMSE</dt>
            <dd class="font-mono text-posterior tnum">{{ stats.filterRmse.toFixed(3) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Measurement RMSE</dt>
            <dd class="flex items-center gap-2 font-mono text-ink tnum">
              <span aria-hidden="true" class="inline-block size-2 rounded-full bg-observed"></span>
              {{ stats.measurementRmse.toFixed(3) }}
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Mean NIS (ideal 2)</dt>
            <dd class="font-mono text-ink tnum">{{ stats.meanNis.toFixed(2) }}</dd>
          </div>
        </dl>

        <div v-if="started && !failed" class="mt-6 grid gap-2 lg:mt-auto">
          <button type="button" :aria-pressed="pausedByUser" :class="buttonClass" @click="togglePlayback">
            {{ pausedByUser ? 'Resume tracking' : 'Pause tracking' }}
          </button>
          <button type="button" :aria-pressed="occluder" :class="buttonClass" @click="occluder = !occluder">
            Occluder
          </button>
          <button type="button" :class="buttonClass" @click="handle?.restart()">Restart tracker</button>
        </div>
      </aside>
    </div>

    <figcaption id="kf-caption" class="mt-3 max-w-[65ch] text-sm text-muted">
      The grey line is the hidden path. Each step the filter predicts (teal), then corrects with the orange measurement
      (navy). Behind the occluder there is nothing to correct with, so the navy 95% region grows until measurements
      resume. The arrow is the inferred velocity, which is never measured.
    </figcaption>
  </figure>
</template>

<style scoped>
.kf-range {
  accent-color: var(--color-posterior);
  min-height: 2.75rem;
}
</style>
