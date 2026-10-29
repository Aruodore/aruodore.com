<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DEFAULT_SETTINGS, DT, OPENING_STEP, STEPS, rmse, type Step } from '~/pieces/extended-kalman-filtering/model'
import { useReducedMotion } from '~/composables/use-reduced-motion'
import { mountExtendedKalman } from '~/pieces/extended-kalman-filtering/simulation'

const host = ref<HTMLElement | null>(null)
const settings = ref({ ...DEFAULT_SETTINGS, inspect: OPENING_STEP })
const record = ref<Step[]>([])
const ready = ref(false)
const failed = ref(false)
const running = ref(false)
const { reduced, resolved } = useReducedMotion()
let syncing = false
const buttonClass =
  'min-h-11 border border-rule px-3 py-2 font-sans text-[10px] uppercase tracking-wide hover:border-posterior'
const visibleRecord = computed(() => record.value.slice(0, settings.value.inspect))
let handle: ReturnType<typeof mountExtendedKalman> | undefined
const selected = computed(() => record.value[settings.value.inspect - 1])
const controls = computed(() => [
  {
    key: 'inspect' as const,
    label: 'Inspect measurement',
    min: 1,
    max: STEPS,
    step: 1,
    value: `${(settings.value.inspect * DT).toFixed(2)} s`,
  },
  {
    key: 'angle' as const,
    label: 'Release angle',
    min: 0.3,
    max: 2.6,
    step: 0.1,
    value: `${settings.value.angle.toFixed(1)} rad`,
  },
  {
    key: 'uncertainty' as const,
    label: 'Initial angle uncertainty',
    short: 'Initial angle sd',
    min: 0.05,
    max: 1.2,
    step: 0.05,
    value: `${settings.value.uncertainty.toFixed(2)} rad`,
  },
  {
    key: 'noise' as const,
    label: 'Sensor noise standard deviation',
    short: 'Sensor noise sd',
    min: 0.02,
    max: 0.3,
    step: 0.01,
    value: settings.value.noise.toFixed(2),
  },
])
function start() {
  if (!host.value || handle) return
  try {
    handle = mountExtendedKalman(
      host.value,
      settings.value,
      (next) => {
        record.value = next
      },
      (inspect, active) => {
        syncing = true
        settings.value.inspect = inspect
        running.value = active
        syncing = false
      },
    )
    ready.value = true
    handle.resume()
  } catch {
    failed.value = true
  }
}
onMounted(() => {
  if (resolved.value && !reduced.value) start()
})
watch(resolved, (value) => {
  if (value && !reduced.value) start()
})
watch(reduced, (value) => {
  if (value) handle?.pause()
})
watch(
  settings,
  (next) => {
    if (!syncing) handle?.setSettings(next)
  },
  { deep: true, flush: 'sync' },
)
onBeforeUnmount(() => handle?.destroy())
</script>

<template>
  <figure class="w-full min-w-0" aria-describedby="ekf-caption">
    <div class="rule-top rule-bottom grid min-w-0 overflow-hidden bg-bg lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div class="relative flex min-w-0 flex-col justify-center">
        <picture v-if="!ready">
          <source media="(max-width: 619px)" srcset="/pieces/extended-kalman-filtering/preview-mobile.svg" />
          <img
            src="/pieces/extended-kalman-filtering/preview.svg"
            width="900"
            height="610"
            class="block w-full"
            alt="EKF and small-angle estimates of a pendulum's angle, with the nonlinear sine sensor and its local tangent below."
          />
        </picture>
        <div ref="host" class="w-full min-w-0" />
        <p v-if="failed" class="py-4 font-sans text-sm text-muted">
          The interactive is unavailable. The static figure shows the same comparison.
        </p>
        <button
          v-if="resolved && reduced && !ready"
          type="button"
          class="absolute inset-x-0 bottom-4 mx-auto min-h-11 w-fit border border-posterior bg-bg px-4 py-2 font-sans text-xs uppercase tracking-widest"
          @click="start"
        >
          Run filter
        </button>
      </div>
      <aside class="flex min-w-0 flex-col border-rule p-4 lg:border-l" aria-label="Extended Kalman filter controls">
        <div class="grid gap-2">
          <label v-for="control in controls" :key="control.key" class="block min-w-0">
            <span class="flex justify-between gap-3"
              ><span class="font-serif text-sm italic">{{ control.short ?? control.label }}</span
              ><output class="shrink-0 whitespace-nowrap font-mono text-xs tnum">{{ control.value }}</output></span
            >
            <input
              v-model.number="settings[control.key]"
              type="range"
              :aria-label="control.label"
              :min="control.min"
              :max="control.max"
              :step="control.step"
              :disabled="!ready"
              class="mt-1 min-h-11 w-full accent-posterior"
            />
          </label>
        </div>
        <dl v-if="selected" class="mt-4 space-y-2 border-t border-rule pt-3 text-xs">
          <div>
            <dt class="text-muted">Local sensor slope</dt>
            <dd class="mt-1 font-mono tnum">{{ Math.cos(selected.predicted.mean[0]).toFixed(3) }}</dd>
          </div>
          <div>
            <dt class="text-muted">EKF angle, approximate 95% interval</dt>
            <dd class="mt-1 font-mono tnum">
              {{ selected.filtered.mean[0].toFixed(2) }} [{{
                (selected.filtered.mean[0] - 1.96 * Math.sqrt(selected.filtered.cov[0])).toFixed(2)
              }}, {{ (selected.filtered.mean[0] + 1.96 * Math.sqrt(selected.filtered.cov[0])).toFixed(2) }}]
            </dd>
          </div>
          <div>
            <dt class="text-muted">EKF angle RMSE (rad)</dt>
            <dd class="mt-1 font-mono tnum">{{ rmse(visibleRecord, 'filtered').toFixed(3) }}</dd>
          </div>
          <div>
            <dt class="text-muted">Small-angle RMSE (rad)</dt>
            <dd class="mt-1 font-mono tnum">{{ rmse(visibleRecord, 'linear').toFixed(3) }}</dd>
          </div>
        </dl>
        <div class="mt-5 grid grid-cols-2 gap-2 lg:mt-auto lg:pt-4">
          <button
            v-if="ready"
            type="button"
            :class="buttonClass"
            :aria-pressed="!running"
            @click="running ? handle?.pause() : handle?.resume()"
          >
            {{ running ? 'Pause tracking' : 'Resume tracking' }}
          </button>
          <button type="button" :disabled="!ready" :class="buttonClass" @click="handle?.restart()">
            Restart tracker
          </button>
          <button type="button" :disabled="!ready" :class="buttonClass" @click="settings.seed += 1">
            New noise sample
          </button>
          <button type="button" :disabled="!ready" :class="buttonClass" @click="settings = { ...DEFAULT_SETTINGS }">
            Reset comparison
          </button>
        </div>
      </aside>
    </div>
    <figcaption id="ekf-caption" class="mt-3 font-sans text-xs leading-relaxed text-muted">
      Solid navy: EKF. Dashed navy: small-angle filter. Grey: hidden angle and its noiseless sensor position. Teal:
      predicted angle interval and sensor tangent before the selected update. Orange: the selected noisy
      horizontal-position reading. Both filters see the same data. Error summaries cover the measurements revealed so
      far. Drag the time slider to pause and inspect an update.
    </figcaption>
  </figure>
</template>
