<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '~/composables/use-reduced-motion'
import { GIBBS_LIMITS } from '~/pieces/gibbs-sampling/model'
import { mountGibbsSampling, type GibbsHandle } from '~/pieces/gibbs-sampling/simulation'

const figure = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const params = ref({ rho: 0.88 })
const sweeps = ref(0)
const lagOne = ref(1)
const ess = ref(0)
const empiricalCorrelation = ref(0)
const theoreticalEfficiency = ref(0)
const complete = ref(false)
const started = ref(false)
const failed = ref(false)
const visible = ref(true)
const manuallyStarted = ref(false)
const { reduced, resolved } = useReducedMotion()
let handle: GibbsHandle | null = null
let observer: IntersectionObserver | null = null

const essPerThousand = computed(() => (sweeps.value > 0 ? (1000 * ess.value) / sweeps.value : 0))

async function start(manual = false) {
  if (manual) manuallyStarted.value = true
  started.value = true
  failed.value = false
  await nextTick()
  if (!canvas.value || handle) return
  try {
    handle = mountGibbsSampling(canvas.value, {
      onStatsUpdate: (stats) => {
        sweeps.value = stats.sweeps
        lagOne.value = stats.lagOneAutocorrelation
        ess.value = stats.effectiveSampleSize
        empiricalCorrelation.value = stats.empiricalCorrelation
        theoreticalEfficiency.value = stats.theoreticalEfficiency
        complete.value = stats.complete
      },
    })
    handle.setParameters({ ...params.value })
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
watch(params, (value) => handle?.setParameters({ ...value }), { deep: true })

onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  handle?.destroy()
  handle = null
})
</script>

<template>
  <figure ref="figure" aria-describedby="gibbs-sampling-caption" class="w-full min-w-0 max-w-full">
    <div class="rule-top rule-bottom grid min-w-0 overflow-hidden bg-bg lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div class="relative min-h-[31rem] min-w-0 bg-bg sm:min-h-[34rem]">
        <img
          v-if="!started || failed"
          src="/pieces/gibbs-sampling/preview.svg"
          width="900"
          height="600"
          alt="Navy elliptical target contours crossed by an orange, axis-aligned Gibbs path, beside traces of both coordinates."
          class="absolute inset-0 h-full w-full object-contain"
        />
        <canvas
          v-show="started && !failed"
          ref="canvas"
          role="img"
          aria-label="A Gibbs chain moving horizontally and vertically through a correlated bivariate normal target, with live traces for x and y."
          class="absolute inset-0 h-full w-full"
        />
        <button
          v-if="resolved && reduced && !started"
          type="button"
          class="absolute inset-x-0 bottom-4 mx-auto min-h-11 w-fit border border-posterior bg-bg px-4 py-2 font-sans text-xs uppercase tracking-widest text-ink active:translate-y-px"
          @click="start(true)"
        >
          Run sampler
        </button>
        <p v-if="failed" class="absolute inset-x-4 bottom-4 bg-bg p-2 text-center font-sans text-xs text-muted">
          Canvas rendering is unavailable. The static figure shows the sampler at high correlation.
        </p>
        <p
          v-if="started && !failed"
          class="pointer-events-none absolute right-6 bottom-2 font-mono text-xs text-muted tnum"
        >
          <span class="font-serif italic">n</span> = {{ sweeps }}<span v-if="complete"> · complete</span>
        </p>
      </div>

      <aside class="flex min-w-0 flex-col border-rule p-4 lg:border-l" aria-label="Gibbs sampling controls">
        <label class="block">
          <span class="flex items-baseline justify-between gap-3">
            <span class="font-serif italic">Target correlation ρ</span>
            <output class="font-mono text-xs tnum">{{ params.rho.toFixed(2) }}</output>
          </span>
          <span class="block font-sans text-xs text-muted"
            >Move toward ±1 to narrow the target and slow the chain. Changing ρ restarts the run.</span
          >
          <input
            v-model.number="params.rho"
            aria-label="Target correlation rho"
            type="range"
            :min="GIBBS_LIMITS.rho.min"
            :max="GIBBS_LIMITS.rho.max"
            step="0.02"
            class="gibbs-range mt-2 w-full"
          />
          <span aria-hidden="true" class="flex justify-between font-mono text-xs text-muted tnum">
            <span>−.98</span><span>0</span><span>.98</span>
          </span>
        </label>

        <dl class="mt-6 space-y-3 border-t border-rule pt-4 text-xs">
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Sample correlation</dt>
            <dd class="font-mono text-ink tnum">{{ empiricalCorrelation.toFixed(3) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Largest lag-1 autocorr.</dt>
            <dd class="font-mono text-posterior tnum">{{ lagOne.toFixed(3) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Smaller coordinate ESS</dt>
            <dd class="font-mono text-posterior tnum">{{ ess.toFixed(0) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Estimated ESS / 1000</dt>
            <dd class="font-mono text-posterior tnum">{{ essPerThousand.toFixed(0) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Long-run ESS / 1000</dt>
            <dd class="font-mono text-posterior tnum">{{ (1000 * theoreticalEfficiency).toFixed(0) }}</dd>
          </div>
        </dl>

        <div v-if="started && !failed" class="mt-6 grid gap-2 lg:mt-auto">
          <button
            type="button"
            class="min-h-11 border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink hover:border-posterior active:translate-y-px"
            @click="handle?.reset()"
          >
            Restart chain
          </button>
          <button
            type="button"
            class="min-h-11 border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink hover:border-posterior active:translate-y-px"
            @click="handle?.regenerate()"
          >
            New seed
          </button>
        </div>
      </aside>
    </div>

    <figcaption id="gibbs-sampling-caption" class="mt-3 max-w-[65ch] text-sm text-muted">
      Navy contours mark the target density. The orange path records completed sweeps; the dashed teal corner marks the
      latest pair of conditional draws. As the target narrows, the coordinate traces retain longer runs and each
      thousand sweeps contains less independent information.
    </figcaption>
  </figure>
</template>

<style scoped>
.gibbs-range {
  accent-color: var(--color-posterior);
  min-height: 2.75rem;
}
</style>
