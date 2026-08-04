<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useElementFullscreen } from '~/composables/use-element-fullscreen'
import { useReducedMotion } from '~/composables/use-reduced-motion'
import { mountOrnsteinUhlenbeck, type OrnsteinUhlenbeckHandle } from '~/pieces/ornstein-uhlenbeck/simulation'

type SheetState = 'collapsed' | 'expanded'

const figure = ref<HTMLElement | null>(null)
const workspace = ref<HTMLElement | null>(null)
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
const sheetState = ref<SheetState>('collapsed')
const { reduced, resolved } = useReducedMotion()
const { isFullscreen, enterFullscreen, exitFullscreen, cleanupFullscreen } = useElementFullscreen(workspace)
const memory = computed(() => 1 / theta.value)
const stationarySd = computed(() => Math.sqrt(stationaryVariance.value))
let handle: OrnsteinUhlenbeckHandle | null = null
let observer: IntersectionObserver | null = null
let swipeStartY: number | null = null
let ignoreHandleClick = false

function browserTestParticleCount() {
  return typeof navigator !== 'undefined' && (navigator.webdriver || navigator.userAgent.includes('Chrome-Lighthouse'))
    ? 2_000
    : undefined
}

async function start(manual = false) {
  if (manual) manuallyStarted.value = true
  started.value = true
  failed.value = false
  await nextTick()
  if (!container.value || handle) return
  try {
    handle = mountOrnsteinUhlenbeck(container.value, {
      N: browserTestParticleCount(),
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
  if (document.hidden || (!visible.value && !isFullscreen.value) || (reduced.value && !manuallyStarted.value))
    handle.pause()
  else handle.resume()
}

async function enter() {
  await enterFullscreen()
  sheetState.value = 'collapsed'
  syncPlayback()
}

async function exit() {
  await exitFullscreen()
  sheetState.value = 'collapsed'
  syncPlayback()
}

function toggleSheet() {
  if (ignoreHandleClick) {
    ignoreHandleClick = false
    return
  }
  sheetState.value = sheetState.value === 'collapsed' ? 'expanded' : 'collapsed'
}
function onPointerDown(event: PointerEvent) {
  swipeStartY = event.clientY
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.setPointerCapture(event.pointerId)
}
function onPointerUp(event: PointerEvent) {
  if (swipeStartY === null) return
  const distance = event.clientY - swipeStartY
  swipeStartY = null
  if (Math.abs(distance) < 36) return
  ignoreHandleClick = true
  sheetState.value = distance < 0 ? 'expanded' : 'collapsed'
}
function onVisibilityChange() {
  syncPlayback()
}
function onViewportChange() {
  window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0)
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
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('orientationchange', onViewportChange)
})

watch(
  resolved,
  (ready) => {
    if (ready && !reduced.value) void start(false)
  },
  { immediate: true },
)
watch(reduced, (shouldReduce) => {
  if (shouldReduce) handle?.pause()
  else if (started.value) syncPlayback()
})
watch([theta, mu, sigma], () => handle?.setParameters({ theta: theta.value, mu: mu.value, sigma: sigma.value }))
watch(isFullscreen, async () => {
  await nextTick()
  onViewportChange()
  syncPlayback()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('orientationchange', onViewportChange)
  cleanupFullscreen()
  handle?.destroy()
  handle = null
})
</script>

<template>
  <figure ref="figure" aria-describedby="ou-caption" class="w-full min-w-0 max-w-full">
    <div
      ref="workspace"
      class="ou-workspace rule-top rule-bottom grid min-w-0 overflow-hidden bg-bg lg:grid-cols-[minmax(0,1fr)_15rem]"
      :class="{ 'is-fullscreen': isFullscreen }"
    >
      <div class="canvas-area relative min-w-0 min-h-[22rem] bg-bg lg:min-h-[36rem]">
        <img
          v-if="!started || failed"
          src="/pieces/ornstein-uhlenbeck/preview.png"
          width="512"
          height="512"
          alt="A navy cloud distributed around an orange equilibrium point inside a spherical reference shell."
          class="absolute inset-0 h-full w-full object-contain"
        />
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
          <div class="pointer-events-none absolute bottom-3 left-3 font-sans text-xs text-muted">
            Drag to orbit · Pinch or scroll to zoom
          </div>
        </template>
      </div>

      <aside
        class="control-sidebar flex min-w-0 flex-col border-rule p-4 lg:border-l"
        aria-label="Ornstein–Uhlenbeck controls"
      >
        <div class="space-y-5">
          <label class="block"
            ><span class="flex items-baseline justify-between gap-3"
              ><span class="font-serif italic">Mean reversion, θ</span
              ><output class="font-mono text-xs tnum">{{ theta.toFixed(2) }}</output></span
            ><span class="block font-sans text-xs text-muted">Strength of mean reversion.</span
            ><input
              v-model.number="theta"
              aria-label="Mean reversion strength theta"
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              class="ou-range mt-1 w-full"
          /></label>
          <label class="block"
            ><span class="flex items-baseline justify-between gap-3"
              ><span class="font-serif italic">Noise, σ</span
              ><output class="font-mono text-xs tnum">{{ sigma.toFixed(2) }}</output></span
            ><span class="block font-sans text-xs text-muted">Size of random disturbances.</span
            ><input
              v-model.number="sigma"
              aria-label="Random disturbance size sigma"
              type="range"
              min="0.2"
              max="2"
              step="0.05"
              class="ou-range mt-1 w-full"
          /></label>
          <label class="block"
            ><span class="flex items-baseline justify-between gap-3"
              ><span class="font-serif italic">Equilibrium, μ</span
              ><output class="font-mono text-xs tnum">{{ mu.toFixed(1) }}</output></span
            ><span class="block font-sans text-xs text-muted">Equilibrium location.</span
            ><input
              v-model.number="mu"
              aria-label="Equilibrium location mu"
              type="range"
              min="-2"
              max="2"
              step="0.1"
              class="ou-range mt-1 w-full"
          /></label>
        </div>
        <dl class="mt-6 space-y-3 border-t border-rule pt-4 text-xs">
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Empirical variance</dt>
            <dd class="font-mono tnum text-posterior">{{ empiricalVariance.toFixed(3) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Stationary variance</dt>
            <dd class="font-mono tnum">{{ stationaryVariance.toFixed(3) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Stationary SD</dt>
            <dd class="font-mono tnum">{{ stationarySd.toFixed(3) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Memory, 1/θ</dt>
            <dd class="font-mono tnum">{{ memory.toFixed(2) }} s</dd>
          </div>
        </dl>
        <p v-if="isFullscreen" class="mt-5 font-sans text-xs text-muted">
          Drag to orbit · Pinch or scroll to zoom · Reset restarts the process · Escape exits full screen
        </p>
        <div v-if="started && !failed" class="mt-6 grid gap-2 lg:mt-auto">
          <button
            type="button"
            class="min-h-11 border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink hover:border-posterior"
            @click="handle?.reset()"
          >
            Reset
          </button>
          <button
            v-if="isFullscreen"
            type="button"
            class="min-h-11 border border-posterior px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink"
            @click="exit"
          >
            Exit full screen
          </button>
        </div>
      </aside>

      <section
        v-if="isFullscreen"
        class="mobile-sheet absolute inset-x-0 bottom-0 z-10 flex max-h-[70dvh] flex-col border-t border-rule bg-bg/95 pb-[env(safe-area-inset-bottom)]"
        :class="`sheet-${sheetState}`"
        aria-label="Simulation controls"
      >
        <div class="flex items-center gap-2 px-3">
          <button
            type="button"
            class="sheet-handle flex min-h-11 flex-1 items-center gap-3 text-left font-sans text-xs uppercase tracking-widest"
            :aria-expanded="sheetState === 'expanded'"
            aria-controls="ou-sheet-content"
            @click="toggleSheet"
            @pointerdown="onPointerDown"
            @pointerup="onPointerUp"
          >
            <span class="h-1 w-10 rounded-full bg-rule" aria-hidden="true" /> Controls
          </button>
          <button type="button" class="min-h-11 px-2 font-sans text-xs text-ink" @click="exit">Exit</button>
        </div>
        <p class="px-3 pb-2 font-sans text-xs text-muted">Drag to orbit · Pinch or scroll to zoom</p>
        <div
          v-show="sheetState === 'expanded'"
          id="ou-sheet-content"
          class="min-h-0 overflow-y-auto border-t border-rule p-4"
        >
          <div class="space-y-5">
            <label class="block"
              ><span class="flex justify-between"
                ><span class="italic">Mean reversion, θ</span
                ><output class="font-mono text-xs">{{ theta.toFixed(2) }}</output></span
              ><span class="block font-sans text-xs text-muted">Strength of mean reversion.</span
              ><input
                v-model.number="theta"
                aria-label="Mean reversion strength theta"
                type="range"
                min="0.1"
                max="2"
                step="0.05"
                class="ou-range w-full"
            /></label>
            <label class="block"
              ><span class="flex justify-between"
                ><span class="italic">Noise, σ</span
                ><output class="font-mono text-xs">{{ sigma.toFixed(2) }}</output></span
              ><span class="block font-sans text-xs text-muted">Size of random disturbances.</span
              ><input
                v-model.number="sigma"
                aria-label="Random disturbance size sigma"
                type="range"
                min="0.2"
                max="2"
                step="0.05"
                class="ou-range w-full"
            /></label>
            <label class="block"
              ><span class="flex justify-between"
                ><span class="italic">Equilibrium, μ</span
                ><output class="font-mono text-xs">{{ mu.toFixed(1) }}</output></span
              ><span class="block font-sans text-xs text-muted">Equilibrium location.</span
              ><input
                v-model.number="mu"
                aria-label="Equilibrium location mu"
                type="range"
                min="-2"
                max="2"
                step="0.1"
                class="ou-range w-full"
            /></label>
          </div>
          <dl class="mt-5 space-y-2 border-t border-rule pt-4 text-xs">
            <div class="flex justify-between">
              <dt>Empirical variance</dt>
              <dd class="font-mono text-posterior">{{ empiricalVariance.toFixed(3) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt>Stationary variance</dt>
              <dd class="font-mono">{{ stationaryVariance.toFixed(3) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt>Memory, 1/θ</dt>
              <dd class="font-mono">{{ memory.toFixed(2) }} s</dd>
            </div>
          </dl>
          <button
            type="button"
            class="mt-4 w-full border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink"
            @click="handle?.reset()"
          >
            Reset
          </button>
        </div>
      </section>
    </div>

    <figcaption
      id="ou-caption"
      class="mt-3 flex flex-wrap items-center justify-between gap-3 font-sans text-xs text-muted"
    >
      <span>75,000 independent paths. Orange marks μ; the shell marks the stationary RMS distance.</span>
      <button
        v-if="started && !failed"
        type="button"
        class="min-h-11 border border-posterior px-3 py-2 text-ink uppercase tracking-widest"
        @click="enter"
      >
        Enter full screen
      </button>
    </figcaption>
  </figure>
</template>

<style scoped>
.mobile-sheet {
  display: none;
}
.ou-range {
  height: 2.75rem;
  accent-color: var(--color-ink);
  cursor: pointer;
}
.ou-workspace:fullscreen,
.ou-workspace[data-fullscreen-fallback] {
  position: relative;
  width: 100vw;
  height: 100dvh;
  max-width: none;
  grid-template-columns: minmax(0, 1fr) 18rem;
  border: 0;
}
.ou-workspace[data-fullscreen-fallback] {
  position: fixed;
  inset: 0;
  z-index: 1000;
}
.ou-workspace:fullscreen .canvas-area,
.ou-workspace[data-fullscreen-fallback] .canvas-area {
  min-height: 0;
}
@media (max-width: 767px) {
  .ou-workspace:fullscreen,
  .ou-workspace[data-fullscreen-fallback] {
    display: block;
  }
  .ou-workspace:fullscreen .canvas-area,
  .ou-workspace[data-fullscreen-fallback] .canvas-area {
    height: 100%;
  }
  .ou-workspace:fullscreen .control-sidebar,
  .ou-workspace[data-fullscreen-fallback] .control-sidebar {
    display: none;
  }
  .mobile-sheet {
    display: flex;
  }
  .sheet-collapsed {
    max-height: calc(5.75rem + env(safe-area-inset-bottom));
  }
}
</style>
