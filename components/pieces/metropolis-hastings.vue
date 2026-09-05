<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '~/composables/use-reduced-motion'
import { METROPOLIS_HASTINGS_LIMITS } from '~/pieces/metropolis-hastings/model'
import { mountMetropolisHastings, type MetropolisHastingsHandle } from '~/pieces/metropolis-hastings/simulation'

const figure = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const params = ref({ proposalSd: 1.4 })
const draws = ref(0)
const acceptanceRate = ref(0)
const lagOne = ref(1)
const ess = ref(1)
const chainMean = ref(0)
const targetMean = ref(0)
const complete = ref(false)
const started = ref(false)
const failed = ref(false)
const visible = ref(true)
const manuallyStarted = ref(false)
const { reduced, resolved } = useReducedMotion()
let handle: MetropolisHastingsHandle | null = null
let observer: IntersectionObserver | null = null

const essPerThousand = computed(() => (draws.value > 0 ? (1000 * ess.value) / draws.value : 0))

async function start(manual = false) {
  if (manual) manuallyStarted.value = true
  started.value = true
  failed.value = false
  await nextTick()
  if (!canvas.value || handle) return
  try {
    handle = mountMetropolisHastings(canvas.value, {
      onStatsUpdate: (stats) => {
        draws.value = stats.draws
        acceptanceRate.value = stats.acceptanceRate
        lagOne.value = stats.lagOneAutocorrelation
        ess.value = stats.effectiveSampleSize
        chainMean.value = stats.chainMean
        targetMean.value = stats.targetMean
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
  <figure ref="figure" aria-describedby="metropolis-hastings-caption" class="w-full min-w-0 max-w-full">
    <div class="rule-top rule-bottom grid min-w-0 overflow-hidden bg-bg lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div class="relative min-h-[25rem] min-w-0 bg-bg sm:min-h-[34rem]">
        <img
          v-if="!started || failed"
          src="/pieces/metropolis-hastings/preview.svg"
          width="900"
          height="600"
          alt="An orange histogram of chain draws filling in a navy bimodal target density, with a dashed teal proposal kernel on the current state, beside an orange trace of the most recent draws moving between the two modes."
          class="absolute inset-0 h-full w-full object-contain"
        />
        <canvas
          v-show="started && !failed"
          ref="canvas"
          role="img"
          aria-label="An orange empirical histogram of Metropolis draws fills in against the navy target density, while a teal proposal kernel follows the current state and an orange trace records accepted and rejected moves."
          class="absolute inset-0 h-full w-full"
        />
        <button
          v-if="resolved && reduced && !started"
          type="button"
          class="absolute inset-x-0 bottom-4 mx-auto min-h-11 w-fit border border-posterior bg-bg px-4 py-2 font-sans text-xs uppercase tracking-widest text-ink active:translate-y-px"
          @click="start(true)"
        >
          Run chain
        </button>
        <p v-if="failed" class="absolute inset-x-4 bottom-4 bg-bg p-2 text-center font-sans text-xs text-muted">
          Canvas rendering is unavailable. The static figure shows the same chain.
        </p>
        <p
          v-if="started && !failed"
          class="pointer-events-none absolute right-6 bottom-2 font-mono text-xs text-muted tnum"
        >
          <span class="font-serif italic">n</span> = {{ draws }}<span v-if="complete"> · complete</span>
        </p>
      </div>

      <aside class="flex min-w-0 flex-col border-rule p-4 lg:border-l" aria-label="Metropolis-Hastings controls">
        <div class="space-y-5">
          <label class="block">
            <span class="flex items-baseline justify-between gap-3">
              <span class="font-serif italic">Proposal σ</span>
              <output class="font-mono text-xs tnum">{{ params.proposalSd.toFixed(2) }}</output>
            </span>
            <span class="block font-sans text-xs text-muted"
              >Random-walk step size. Changing it restarts the chain.</span
            >
            <input
              v-model.number="params.proposalSd"
              aria-label="Proposal standard deviation sigma"
              type="range"
              :min="METROPOLIS_HASTINGS_LIMITS.proposalSd.min"
              :max="METROPOLIS_HASTINGS_LIMITS.proposalSd.max"
              step="0.05"
              class="metropolis-range mt-2 w-full"
            />
          </label>
        </div>

        <dl class="mt-6 space-y-3 border-t border-rule pt-4 text-xs">
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Acceptance</dt>
            <dd class="font-mono text-ink tnum">{{ (100 * acceptanceRate).toFixed(1) }}%</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Lag-1 autocorrelation</dt>
            <dd class="font-mono text-posterior tnum">{{ lagOne.toFixed(3) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Effective sample size</dt>
            <dd class="font-mono text-posterior tnum">{{ ess.toFixed(0) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">ESS per 1000 draws</dt>
            <dd class="font-mono text-posterior tnum">{{ essPerThousand.toFixed(0) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Chain mean</dt>
            <dd class="font-mono text-ink tnum">{{ chainMean.toFixed(3) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Target mean</dt>
            <dd class="font-mono text-posterior tnum">{{ targetMean.toFixed(3) }}</dd>
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

    <figcaption id="metropolis-hastings-caption" class="mt-3 max-w-[65ch] text-sm text-muted">
      The navy curve is the exact target density and the orange bars are the empirical density of the draws so far. The
      teal bump is the proposal kernel centred on the current state, drawn at a fixed height rather than on the density
      scale. In the trace, a rejected move leaves the chain where it was, so rejection appears as a flat segment; the
      hollow marker is the most recent rejected proposal.
    </figcaption>
  </figure>
</template>

<style scoped>
.metropolis-range {
  accent-color: var(--color-posterior);
  min-height: 2.75rem;
}
</style>
