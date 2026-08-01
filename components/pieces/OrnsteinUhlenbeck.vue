<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '~/composables/useReducedMotion'
import {
  mountOrnsteinUhlenbeck,
  type OrnsteinUhlenbeckHandle,
} from '~/pieces/ornstein-uhlenbeck/simulation'

const figure = ref<HTMLElement | null>(null)
const container = ref<HTMLDivElement | null>(null)
const theta = ref(0.5)
const mu = ref(0)
const sigma = ref(1)
const elapsed = ref(0)
const empiricalVariance = ref(0)
const stationaryVariance = ref(1)
const started = ref(false)
const failed = ref(false)
const visible = ref(true)
const manuallyStarted = ref(false)
const { reduced, resolved } = useReducedMotion()
let handle: OrnsteinUhlenbeckHandle | null = null
let observer: IntersectionObserver | null = null

const memory = computed(() => 1 / theta.value)
const stationarySd = computed(() => Math.sqrt(stationaryVariance.value))

async function start(manual = false) {
  if (manual) manuallyStarted.value = true
  started.value = true
  failed.value = false
  await nextTick()
  if (!container.value || handle) return
  try {
    handle = mountOrnsteinUhlenbeck(container.value, {
      parameters: { theta: theta.value, mu: mu.value, sigma: sigma.value },
      onStatsUpdate: (stats) => {
        elapsed.value = stats.elapsed
        empiricalVariance.value = stats.empiricalVariance
        stationaryVariance.value = stats.stationaryVariance
      },
    })
    syncPlayback()
  } catch {
    failed.value = true
    started.value = false
  }
}

function syncPlayback() {
  if (!handle) return
  if (document.hidden || !visible.value || reduced.value && !manuallyStarted.value) handle.pause()
  else handle.resume()
}

function onVisibilityChange() { syncPlayback() }

onMounted(() => {
  observer = new IntersectionObserver(([entry]) => {
    visible.value = entry?.isIntersecting ?? true
    syncPlayback()
  }, { threshold: 0.05 })
  if (figure.value) observer.observe(figure.value)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

watch(resolved, (ready) => {
  if (ready && !reduced.value) start(false)
}, { immediate: true })
watch(reduced, (shouldReduce) => {
  if (shouldReduce) handle?.pause()
  else if (started.value) syncPlayback()
})
watch([theta, mu, sigma], () => {
  handle?.setParameters({ theta: theta.value, mu: mu.value, sigma: sigma.value })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  handle?.destroy()
  handle = null
})
</script>

<template>
  <figure ref="figure" aria-describedby="ou-caption">
    <div class="rule-top rule-bottom grid lg:grid-cols-[1fr_15rem]">
      <div class="relative min-h-[22rem] bg-bg lg:min-h-[36rem]">
        <img
          v-if="!started || failed"
          src="/pieces/ornstein-uhlenbeck/preview.png"
          width="512"
          height="512"
          alt="A navy cloud distributed around an orange equilibrium point inside a spherical reference shell."
          class="absolute inset-0 h-full w-full object-contain"
        >
        <div
          v-show="started && !failed"
          ref="container"
          role="img"
          aria-label="Three-dimensional Ornstein–Uhlenbeck process: 75,000 paths fluctuate around an orange equilibrium point inside a stationary reference shell."
          class="absolute inset-0"
        />
        <button
          v-if="resolved && reduced && !started"
          type="button"
          class="absolute inset-x-0 bottom-4 mx-auto w-fit min-h-11 border border-posterior bg-bg px-4 py-2 font-sans text-xs uppercase tracking-widest text-ink"
          @click="start(true)"
        >
          Run simulation
        </button>
        <p v-if="failed" class="absolute inset-x-4 bottom-4 bg-bg p-2 text-center font-sans text-xs text-muted">
          WebGL is unavailable. The static image shows the same process.
        </p>
        <template v-if="started && !failed">
          <div class="pointer-events-none absolute left-3 top-3 font-mono text-xs text-muted tnum">
            <span class="italic font-serif">t</span> = {{ elapsed.toFixed(1) }} s
          </div>
          <div class="pointer-events-none absolute bottom-3 left-3 font-sans text-xs text-muted">Drag to orbit · scroll to zoom</div>
        </template>
      </div>

      <div class="flex flex-col border-rule p-4 lg:border-l">
        <div class="space-y-6">
          <label class="block"><span class="flex items-baseline justify-between gap-3"><span class="font-serif italic">Mean reversion, θ</span><output class="font-mono text-xs tnum">{{ theta.toFixed(2) }}</output></span><input v-model.number="theta" type="range" min="0.1" max="2" step="0.05" class="ou-range mt-2 w-full"></label>
          <label class="block"><span class="flex items-baseline justify-between gap-3"><span class="font-serif italic">Noise, σ</span><output class="font-mono text-xs tnum">{{ sigma.toFixed(2) }}</output></span><input v-model.number="sigma" type="range" min="0.2" max="2" step="0.05" class="ou-range mt-2 w-full"></label>
          <label class="block"><span class="flex items-baseline justify-between gap-3"><span class="font-serif italic">Equilibrium, μ</span><output class="font-mono text-xs tnum">{{ mu.toFixed(1) }}</output></span><input v-model.number="mu" type="range" min="-2" max="2" step="0.1" class="ou-range mt-2 w-full"></label>
        </div>

        <dl class="mt-8 space-y-3 border-t border-rule pt-4 text-xs">
          <div class="flex justify-between gap-3"><dt class="text-muted">Empirical variance</dt><dd class="font-mono tnum text-posterior">{{ empiricalVariance.toFixed(3) }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-muted">Stationary variance</dt><dd class="font-mono tnum">{{ stationaryVariance.toFixed(3) }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-muted">Stationary SD</dt><dd class="font-mono tnum">{{ stationarySd.toFixed(3) }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-muted">Memory, 1/θ</dt><dd class="font-mono tnum">{{ memory.toFixed(2) }} s</dd></div>
        </dl>

        <button v-if="started && !failed" type="button" class="mt-8 min-h-11 border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink hover:border-posterior active:translate-y-px lg:mt-auto" @click="handle?.reset()">
          Restart from zero
        </button>
      </div>
    </div>

    <figcaption id="ou-caption" class="mt-3 flex flex-wrap justify-between gap-2 font-sans text-xs text-muted">
      <span>75,000 independent paths. Orange marks μ; the shell marks the stationary RMS distance.</span>
      <span>Exact transition update</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.ou-range {
  height: 2.75rem;
  accent-color: var(--color-posterior);
  cursor: pointer;
}
</style>
