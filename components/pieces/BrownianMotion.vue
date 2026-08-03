<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '~/composables/useReducedMotion'
import {
  mountBrownianMotion,
  type BrownianMotionHandle,
} from '~/pieces/brownian-motion/simulation'

const figure = ref<HTMLElement | null>(null)
const container = ref<HTMLDivElement | null>(null)
const elapsed = ref(0)
const started = ref(false)
const failed = ref(false)
const visible = ref(true)
const manuallyStarted = ref(false)
const { reduced, resolved } = useReducedMotion()
const variance = computed(() => elapsed.value)
const rmsRadius = computed(() => Math.sqrt(3 * elapsed.value))
let handle: BrownianMotionHandle | null = null
let observer: IntersectionObserver | null = null

async function start(manual = false) {
  if (manual) manuallyStarted.value = true
  started.value = true
  failed.value = false
  await nextTick()
  if (!container.value || handle) return
  try {
    handle = mountBrownianMotion(container.value, {
      onTimeUpdate: (t) => { elapsed.value = t },
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

onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  handle?.destroy()
  handle = null
})
</script>

<template>
  <figure ref="figure" aria-describedby="brownian-caption" class="w-full min-w-0 max-w-full">
    <div class="relative w-full bg-bg rule-top rule-bottom" style="aspect-ratio: 900 / 600;">
      <img
        v-if="!started || failed"
        src="/pieces/brownian-motion/preview.png"
        width="512"
        height="512"
        alt="A navy cloud of Brownian particles spreading around an orange traced path and a spherical reference shell."
        class="absolute inset-0 h-full w-full object-contain"
      >
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
        <div class="pointer-events-none absolute top-3 left-3 font-mono text-xs text-muted tnum" aria-live="off">
          <span class="italic font-serif">t</span> = {{ elapsed.toFixed(1) }} s
        </div>
        <dl class="pointer-events-none absolute right-3 top-3 space-y-1 text-right font-sans text-xs text-muted">
          <div class="flex justify-end gap-3"><dt>Variance</dt><dd class="min-w-14 font-mono text-posterior tnum">{{ variance.toFixed(2) }}</dd></div>
          <div class="flex justify-end gap-3"><dt>RMS radius</dt><dd class="min-w-14 font-mono tnum">{{ rmsRadius.toFixed(2) }}</dd></div>
        </dl>
      </template>
    </div>

    <figcaption id="brownian-caption" class="mt-3 flex flex-wrap items-center justify-between gap-3 font-sans text-xs text-muted">
      <span>100,000 walkers. Orange traces one path; the shell marks the theoretical RMS distance.</span>
      <button
        v-if="started && !failed"
        type="button"
        class="min-h-11 border border-rule px-3 py-2 text-ink hover:border-posterior uppercase tracking-widest"
        @click="handle?.reset()"
      >
        Reset
      </button>
    </figcaption>
  </figure>
</template>
