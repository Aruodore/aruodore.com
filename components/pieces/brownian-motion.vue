<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useElementFullscreen } from '~/composables/use-element-fullscreen'
import { useReducedMotion } from '~/composables/use-reduced-motion'
import { mountBrownianMotion, type BrownianMotionHandle } from '~/pieces/brownian-motion/simulation'

type SheetState = 'collapsed' | 'expanded'

const figure = ref<HTMLElement | null>(null)
const workspace = ref<HTMLElement | null>(null)
const container = ref<HTMLDivElement | null>(null)
const elapsed = ref(0)
const started = ref(false)
const failed = ref(false)
const visible = ref(true)
const manuallyStarted = ref(false)
const sheetState = ref<SheetState>('collapsed')
const { reduced, resolved } = useReducedMotion()
const { isFullscreen, enterFullscreen, exitFullscreen, cleanupFullscreen } = useElementFullscreen(workspace)
const variance = computed(() => elapsed.value)
const rmsRadius = computed(() => Math.sqrt(3 * elapsed.value))
let handle: BrownianMotionHandle | null = null
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
    handle = mountBrownianMotion(container.value, {
      N: browserTestParticleCount(),
      onTimeUpdate: (t) => {
        elapsed.value = t
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
  <figure ref="figure" aria-describedby="brownian-caption" class="w-full min-w-0 max-w-full">
    <div
      ref="workspace"
      class="interactive-workspace relative w-full overflow-hidden bg-bg rule-top rule-bottom"
      :class="{ 'is-fullscreen': isFullscreen }"
      style="aspect-ratio: 900 / 600"
    >
      <img
        v-if="!started || failed"
        src="/pieces/brownian-motion/preview.png"
        width="512"
        height="512"
        alt="A navy cloud of Brownian particles spreading around an orange traced path and a spherical reference shell."
        class="absolute inset-0 h-full w-full object-contain"
      />
      <div
        v-show="started && !failed"
        ref="container"
        role="img"
        aria-label="Three-dimensional Brownian motion: 100,000 independent random walkers expand from the origin while one path is traced."
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
        <dl class="pointer-events-none absolute right-3 top-3 space-y-1 text-right font-sans text-xs text-muted">
          <div class="flex justify-end gap-3">
            <dt>Variance</dt>
            <dd class="min-w-14 font-mono text-posterior tnum">{{ variance.toFixed(2) }}</dd>
          </div>
          <div class="flex justify-end gap-3">
            <dt>RMS radius</dt>
            <dd class="min-w-14 font-mono tnum">{{ rmsRadius.toFixed(2) }}</dd>
          </div>
        </dl>
      </template>

      <div
        v-if="isFullscreen"
        class="desktop-guide absolute inset-x-0 bottom-0 items-center justify-between gap-4 border-t border-rule bg-bg/95 px-4 py-2 font-sans text-xs text-muted"
      >
        <span>Drag to orbit · Pinch or scroll to zoom · Reset restarts the process · Escape exits full screen</span>
        <div class="flex gap-2">
          <button
            type="button"
            class="border border-rule px-3 text-ink hover:border-posterior"
            @click="handle?.reset()"
          >
            Reset
          </button>
          <button type="button" class="border border-rule px-3 text-ink hover:border-posterior" @click="exit">
            Exit full screen
          </button>
        </div>
      </div>

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
            aria-controls="brownian-sheet-content"
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
          id="brownian-sheet-content"
          class="min-h-0 overflow-y-auto border-t border-rule p-4"
        >
          <p class="font-sans text-sm text-muted">
            Reset restarts the process from the origin. Escape exits full screen when a keyboard is available.
          </p>
          <dl class="mt-4 space-y-2 text-xs">
            <div class="flex justify-between">
              <dt>Variance</dt>
              <dd class="font-mono text-posterior tnum">{{ variance.toFixed(2) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt>RMS radius</dt>
              <dd class="font-mono tnum">{{ rmsRadius.toFixed(2) }}</dd>
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
      id="brownian-caption"
      class="mt-3 flex flex-wrap items-center justify-between gap-3 font-sans text-xs text-muted"
    >
      <span>100,000 walkers. Orange traces one path; the shell marks the theoretical RMS distance.</span>
      <div v-if="started && !failed" class="flex flex-wrap gap-2">
        <button
          type="button"
          class="min-h-11 border border-rule px-3 py-2 text-ink hover:border-posterior uppercase tracking-widest"
          @click="handle?.reset()"
        >
          Reset
        </button>
        <button
          type="button"
          class="min-h-11 border border-posterior px-3 py-2 text-ink uppercase tracking-widest"
          @click="enter"
        >
          Enter full screen
        </button>
      </div>
    </figcaption>
  </figure>
</template>

<style scoped>
.desktop-guide {
  display: flex;
}
.mobile-sheet {
  display: none;
}
.interactive-workspace:fullscreen,
.interactive-workspace[data-fullscreen-fallback] {
  width: 100vw;
  height: 100dvh;
  max-width: none;
  aspect-ratio: auto !important;
  border: 0;
}
.interactive-workspace[data-fullscreen-fallback] {
  position: fixed;
  inset: 0;
  z-index: 1000;
}
@media (max-width: 767px) {
  .desktop-guide {
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
