<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '~/composables/use-reduced-motion'
import { BETA_BINOMIAL_LIMITS } from '~/pieces/beta-binomial-update/model'
import { mountBetaBinomialUpdate, type BetaBinomialHandle } from '~/pieces/beta-binomial-update/simulation'

const sliders = [
  {
    key: 'alpha0',
    label: 'Prior α',
    aria: 'Prior alpha, weight on successes',
    hint: 'Prior weight for successes.',
    limits: BETA_BINOMIAL_LIMITS.alpha0,
    step: 0.5,
    digits: 1,
  },
  {
    key: 'beta0',
    label: 'Prior β',
    aria: 'Prior beta, weight on failures',
    hint: 'Prior weight for failures.',
    limits: BETA_BINOMIAL_LIMITS.beta0,
    step: 0.5,
    digits: 1,
  },
  {
    key: 'theta',
    label: 'True p',
    aria: 'True success probability the data are generated with',
    hint: 'Hidden from the posterior.',
    limits: BETA_BINOMIAL_LIMITS.theta,
    step: 0.01,
    digits: 2,
  },
] as const

const figure = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const params = ref({ alpha0: 2, beta0: 2, theta: 0.62 })
const trials = ref(0)
const successes = ref(0)
const posteriorMean = ref(0.5)
const lower = ref(0)
const upper = ref(1)
const priorEss = ref(4)
const started = ref(false)
const failed = ref(false)
const visible = ref(true)
const manuallyStarted = ref(false)
const { reduced, resolved } = useReducedMotion()
let handle: BetaBinomialHandle | null = null
let observer: IntersectionObserver | null = null

async function start(manual = false) {
  if (manual) manuallyStarted.value = true
  started.value = true
  failed.value = false
  await nextTick()
  if (!canvas.value || handle) return
  try {
    handle = mountBetaBinomialUpdate(canvas.value, {
      onStatsUpdate: (stats) => {
        trials.value = stats.trials
        successes.value = stats.successes
        posteriorMean.value = stats.posteriorMean
        lower.value = stats.interval.lower
        upper.value = stats.interval.upper
        priorEss.value = stats.priorEss
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
  <figure ref="figure" aria-describedby="beta-binomial-caption" class="w-full min-w-0 max-w-full">
    <div class="rule-top rule-bottom grid min-w-0 overflow-hidden bg-bg lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div class="relative min-h-[25rem] min-w-0 bg-bg sm:min-h-[34rem]">
        <img
          v-if="!started || failed"
          src="/pieces/beta-binomial-update/preview.svg"
          width="900"
          height="600"
          alt="A teal beta prior and a narrower navy posterior over a success probability, above an orange strip of observed successes and failures."
          class="absolute inset-0 h-full w-full object-contain"
        />
        <canvas
          v-show="started && !failed"
          ref="canvas"
          role="img"
          aria-label="A teal prior density stays fixed while a navy posterior density responds as orange success and failure cells accumulate below, with the data-generating probability marked for comparison."
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
          class="pointer-events-none absolute right-6 bottom-2 font-mono text-xs text-muted tnum"
        >
          <span class="font-serif italic">n</span> = {{ trials }}
        </p>
      </div>

      <aside class="flex min-w-0 flex-col border-rule p-4 lg:border-l" aria-label="Beta-binomial controls">
        <div class="space-y-5">
          <label v-for="slider in sliders" :key="slider.key" class="block">
            <span class="flex items-baseline justify-between gap-3">
              <span class="font-serif italic">{{ slider.label }}</span>
              <output class="font-mono text-xs tnum">{{ params[slider.key].toFixed(slider.digits) }}</output>
            </span>
            <span class="block font-sans text-xs text-muted">{{ slider.hint }}</span>
            <input
              v-model.number="params[slider.key]"
              :aria-label="slider.aria"
              :min="slider.limits.min"
              :max="slider.limits.max"
              :step="slider.step"
              type="range"
              class="beta-binomial-range mt-2 w-full"
            />
          </label>
        </div>

        <dl class="mt-6 space-y-3 border-t border-rule pt-4 text-xs">
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Successes</dt>
            <dd class="font-mono text-ink tnum">{{ successes }} / {{ trials }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Posterior mean</dt>
            <dd class="font-mono text-posterior tnum">{{ posteriorMean.toFixed(3) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">95% credible</dt>
            <dd class="font-mono text-posterior tnum">[{{ lower.toFixed(3) }}, {{ upper.toFixed(3) }}]</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Prior worth</dt>
            <dd class="font-mono text-prior tnum">{{ priorEss.toFixed(1) }} trials</dd>
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
            New data
          </button>
        </div>
      </aside>
    </div>

    <figcaption id="beta-binomial-caption" class="mt-3 max-w-[65ch] text-sm text-muted">
      The teal prior is fixed. The navy posterior and its shaded 95% credible band update after every trial in the
      orange strip, where filled cells are successes and outlined cells are failures. The dashed line is the
      data-generating probability, which the posterior is never told.
    </figcaption>
  </figure>
</template>

<style scoped>
.beta-binomial-range {
  accent-color: var(--color-posterior);
  min-height: 2.75rem;
}
</style>
