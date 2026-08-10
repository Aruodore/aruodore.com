<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '~/composables/use-reduced-motion'
import { mountFirstPassage, type FirstPassageHandle } from '~/pieces/first-passage/simulation'

const figure = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const boundary = ref(1.25)
const sigma = ref(1)
const elapsed = ref(0)
const empiricalCdf = ref(0)
const theoreticalCdf = ref(0)
const crossed = ref(0)
const total = ref(180)
const started = ref(false)
const failed = ref(false)
const visible = ref(true)
const manuallyStarted = ref(false)
const { reduced, resolved } = useReducedMotion()
let handle: FirstPassageHandle | null = null
let observer: IntersectionObserver | null = null

async function start(manual = false) {
  if (manual) manuallyStarted.value = true
  started.value = true
  failed.value = false
  await nextTick()
  if (!canvas.value || handle) return
  try {
    handle = mountFirstPassage(canvas.value, {
      onStatsUpdate: (stats) => {
        elapsed.value = stats.elapsed
        empiricalCdf.value = stats.empiricalCdf
        theoreticalCdf.value = stats.theoreticalCdf
        crossed.value = stats.crossed
        total.value = stats.total
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
  if (document.hidden || !visible.value || (reduced.value && !manuallyStarted.value)) handle.pause()
  else handle.resume()
}

function onVisibilityChange() {
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
  document.addEventListener('visibilitychange', onVisibilityChange)
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
watch([boundary, sigma], () => handle?.setParameters({ boundary: boundary.value, sigma: sigma.value }))

onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  handle?.destroy()
  handle = null
})
</script>

<template>
  <figure ref="figure" aria-describedby="first-passage-caption" class="w-full min-w-0 max-w-full">
    <div class="rule-top rule-bottom grid min-w-0 overflow-hidden bg-bg lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div class="relative min-h-[25rem] min-w-0 bg-bg sm:min-h-[34rem]">
        <img
          v-if="!started || failed"
          src="/pieces/first-passage/preview.svg"
          width="900"
          height="600"
          alt="Orange Brownian paths stopping at a fixed boundary, with their hitting times recorded below."
          class="absolute inset-0 h-full w-full object-contain"
        />
        <canvas
          v-show="started && !failed"
          ref="canvas"
          role="img"
          aria-label="Brownian paths stop at their first crossing of a fixed boundary. A lower orange histogram compares observed hitting times with the navy theoretical density."
          class="absolute inset-0 h-full w-full"
        />
        <button
          v-if="resolved && reduced && !started"
          type="button"
          class="absolute inset-x-0 bottom-4 mx-auto min-h-11 w-fit border border-posterior bg-bg px-4 py-2 font-sans text-xs uppercase tracking-widest text-ink active:translate-y-px"
          @click="start(true)"
        >
          Run experiment
        </button>
        <p v-if="failed" class="absolute inset-x-4 bottom-4 bg-bg p-2 text-center font-sans text-xs text-muted">
          Canvas rendering is unavailable. The static figure shows the same experiment.
        </p>
        <p
          v-if="started && !failed"
          class="pointer-events-none absolute left-12 top-2 font-mono text-xs text-muted tnum"
        >
          <span class="font-serif italic">t</span> = {{ elapsed.toFixed(2) }}
        </p>
      </div>

      <aside class="flex min-w-0 flex-col border-rule p-4 lg:border-l" aria-label="First-passage controls">
        <div class="space-y-5">
          <label class="block">
            <span class="flex items-baseline justify-between gap-3">
              <span class="font-serif italic">Boundary, a</span>
              <output class="font-mono text-xs tnum">{{ boundary.toFixed(2) }}</output>
            </span>
            <span class="block font-sans text-xs text-muted">Level each path must reach.</span>
            <input
              v-model.number="boundary"
              aria-label="Boundary level a"
              type="range"
              min="0.5"
              max="2.5"
              step="0.05"
              class="first-passage-range mt-2 w-full"
            />
          </label>
          <label class="block">
            <span class="flex items-baseline justify-between gap-3">
              <span class="font-serif italic">Noise, σ</span>
              <output class="font-mono text-xs tnum">{{ sigma.toFixed(2) }}</output>
            </span>
            <span class="block font-sans text-xs text-muted">Size of random disturbances.</span>
            <input
              v-model.number="sigma"
              aria-label="Noise amplitude sigma"
              type="range"
              min="0.4"
              max="2"
              step="0.05"
              class="first-passage-range mt-2 w-full"
            />
          </label>
        </div>

        <dl class="mt-6 space-y-3 border-t border-rule pt-4 text-xs">
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Crossed</dt>
            <dd class="font-mono tnum">{{ crossed }} / {{ total }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Empirical</dt>
            <dd class="font-mono text-observed tnum">{{ (100 * empiricalCdf).toFixed(1) }}%</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Theoretical</dt>
            <dd class="font-mono text-posterior tnum">{{ (100 * theoreticalCdf).toFixed(1) }}%</dd>
          </div>
        </dl>

        <div v-if="started && !failed" class="mt-6 grid gap-2 lg:mt-auto">
          <button
            type="button"
            class="min-h-11 border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink hover:border-posterior active:translate-y-px"
            @click="handle?.reset()"
          >
            Replay
          </button>
          <button
            type="button"
            class="min-h-11 border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink hover:border-posterior active:translate-y-px"
            @click="handle?.regenerate()"
          >
            New paths
          </button>
        </div>
      </aside>
    </div>

    <figcaption id="first-passage-caption" class="mt-3 max-w-[65ch] text-sm text-muted">
      Paths stop when they first meet the boundary. Orange bars record simulated hitting times; the navy curve is the
      theoretical density on the same vertical scale.
    </figcaption>
  </figure>
</template>

<style scoped>
.first-passage-range {
  accent-color: var(--color-posterior);
  min-height: 2.75rem;
}
</style>
