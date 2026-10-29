<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  DEFAULT_SETTINGS,
  LAST_STEP,
  DT,
  type SmoothingSettings,
  type SmoothingStats,
} from '~/pieces/kalman-smoothing/model'
import { useReducedMotion } from '~/composables/use-reduced-motion'
import { mountKalmanSmoothing, type PlaybackPhase, type SmoothingHandle } from '~/pieces/kalman-smoothing/simulation'

const host = ref<HTMLElement | null>(null)
const settings = ref<SmoothingSettings>({ ...DEFAULT_SETTINGS })
const stats = ref<SmoothingStats | null>(null)
const ready = ref(false)
const started = ref(false)
const failed = ref(false)
let handle: SmoothingHandle | null = null
let syncingPlayback = false
const running = ref(false)
const phase = ref<PlaybackPhase>('explore')
const { reduced, resolved } = useReducedMotion()
const phaseLabel = computed(
  () =>
    ({
      explore: 'Explore the estimates, or replay the recorded trajectory.',
      forward: 'Playing the recorded trajectory once, from left to right.',
      complete: 'Smoothing complete. Play again when you are ready.',
    })[phase.value],
)
const controls = computed(() => [
  {
    key: 'cutoff' as const,
    label: 'Measurements available through',
    min: 0,
    max: LAST_STEP,
    step: 1,
    value: `${(settings.value.cutoff * DT).toFixed(1)} s`,
  },
  {
    key: 'inspect' as const,
    label: 'Inspect state at',
    min: 0,
    max: settings.value.cutoff,
    step: 1,
    value: `${(settings.value.inspect * DT).toFixed(1)} s`,
  },
  {
    key: 'processNoise' as const,
    label: 'Process noise intensity q',
    min: 0.05,
    max: 2,
    step: 0.05,
    value: settings.value.processNoise.toFixed(2),
  },
  {
    key: 'measurementNoise' as const,
    label: 'Assumed sensor noise r',
    min: 0.05,
    max: 1,
    step: 0.05,
    value: settings.value.measurementNoise.toFixed(2),
  },
])
const buttonClass = 'min-h-11 border border-rule px-3 py-2 font-sans text-xs text-ink hover:border-posterior'

async function start() {
  if (started.value || handle) return
  started.value = true
  await nextTick()
  if (!host.value) return
  try {
    handle = mountKalmanSmoothing(
      host.value,
      (next) => (stats.value = next),
      (state) => {
        syncingPlayback = true
        settings.value = state.settings
        running.value = state.running
        phase.value = state.phase
        syncingPlayback = false
      },
      { autoplay: true, settings: settings.value },
    )
    ready.value = true
  } catch {
    failed.value = true
    started.value = false
  }
}
watch(
  settings,
  (value) => {
    if (syncingPlayback) return
    value.inspect = Math.min(value.inspect, value.cutoff)
    handle?.setSettings(value)
  },
  { deep: true, flush: 'sync' },
)
watch(
  resolved,
  (value) => {
    if (value && !reduced.value) void start()
  },
  { immediate: true },
)
watch(reduced, (value) => {
  if (value) handle?.pause()
})
onBeforeUnmount(() => handle?.destroy())
</script>

<template>
  <figure class="w-full min-w-0" aria-describedby="ks-caption">
    <div class="rule-top rule-bottom">
      <div class="relative aspect-[600/680] min-[620px]:aspect-[3/2]">
        <picture v-if="!ready" class="absolute inset-0 block">
          <source media="(max-width: 619px)" srcset="/pieces/kalman-smoothing/preview-mobile.svg" />
          <img
            src="/pieces/kalman-smoothing/preview.svg"
            width="900"
            height="600"
            alt="Dashed filtering and solid smoothing estimates across a measurement gap. Later observations narrow the smoothed position interval inside the gap."
            class="block h-full w-full object-contain"
          />
        </picture>
        <div ref="host" class="absolute inset-0 w-full min-w-0" />
        <button
          v-if="resolved && reduced && !started && !failed"
          type="button"
          class="absolute inset-x-0 bottom-4 mx-auto min-h-11 w-fit border border-posterior bg-bg px-4 py-2 font-sans text-xs text-ink"
          @click="start"
        >
          Run simulation
        </button>
        <p v-if="failed" class="absolute inset-x-4 bottom-4 bg-bg p-2 text-center font-sans text-sm text-muted">
          The interactive is unavailable. The static figure shows the same comparison.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3 border-t border-rule py-4">
        <button
          type="button"
          :class="buttonClass"
          :disabled="!ready"
          @click="running ? handle?.pause() : handle?.play()"
        >
          {{ running ? 'Pause playback' : 'Play sequence' }}
        </button>
        <button type="button" :class="buttonClass" :disabled="!ready" @click="handle?.restart()">
          Restart playback
        </button>
        <p class="min-w-0 flex-1 basis-64 font-sans text-sm text-muted" role="status">{{ phaseLabel }}</p>
      </div>
      <div class="grid gap-x-8 gap-y-4 border-t border-rule py-5 sm:grid-cols-2">
        <label v-for="control in controls" :key="control.key" class="block min-w-0 font-sans text-sm">
          <span class="flex justify-between gap-3"
            ><span>{{ control.label }}</span
            ><output class="font-mono tnum">{{ control.value }}</output></span
          >
          <input
            v-model.number="settings[control.key]"
            type="range"
            :aria-label="control.label"
            :min="control.min"
            :max="control.max"
            :step="control.step"
            class="mt-1 min-h-11 w-full accent-posterior"
          />
        </label>
      </div>
      <div class="flex flex-wrap gap-3 pb-5">
        <button type="button" :class="buttonClass" :aria-pressed="settings.gap" @click="settings.gap = !settings.gap">
          Measurement gap
        </button>
        <button type="button" :class="buttonClass" @click="settings.seed += 1">New noise sample</button>
        <button type="button" :class="buttonClass" @click="settings = { ...DEFAULT_SETTINGS }">Reset comparison</button>
      </div>
      <dl v-if="stats" class="grid gap-4 border-t border-rule py-5 font-sans text-sm sm:grid-cols-2">
        <div>
          <dt class="text-muted">Filtered position, 95% interval</dt>
          <dd class="mt-1 font-mono tnum">
            {{ stats.filteredMean.toFixed(2) }} [{{ stats.filteredLow.toFixed(2) }},
            {{ stats.filteredHigh.toFixed(2) }}]
          </dd>
        </div>
        <div>
          <dt class="text-muted">Smoothed position, 95% interval</dt>
          <dd class="mt-1 font-mono tnum">
            {{ stats.smoothedMean.toFixed(2) }} [{{ stats.smoothedLow.toFixed(2) }},
            {{ stats.smoothedHigh.toFixed(2) }}]
          </dd>
        </div>
        <div>
          <dt class="text-muted">Filter RMSE, horizontal position</dt>
          <dd class="mt-1 font-mono tnum">{{ stats.filterRmse.toFixed(3) }}</dd>
        </div>
        <div>
          <dt class="text-muted">Smoother RMSE, horizontal position</dt>
          <dd class="mt-1 font-mono tnum">{{ stats.smootherRmse.toFixed(3) }}</dd>
        </div>
      </dl>
    </div>
    <figcaption id="ks-caption" class="mt-3 font-sans text-xs leading-relaxed text-muted">
      The same record, with different information at each state. Dashed navy: filtering. Solid navy: smoothing. Bands:
      pointwise 95% horizontal position intervals. Grey: true position. Orange: available observations. Errors cover 0
      seconds through the selected measurement cutoff, including the gap.
    </figcaption>
  </figure>
</template>
