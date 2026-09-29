<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '~/composables/use-reduced-motion'
import {
  BOOTSTRAP_LIMITS,
  bootstrapMeanStandardError,
  createSeededRandom,
  generateObservedSample,
  mean,
} from '~/pieces/bootstrap/model'
import { mountBootstrap, type BootstrapHandle } from '~/pieces/bootstrap/simulation'

const figure = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const params = ref({ sampleSize: 24, speed: 12 })
const initialSample = generateObservedSample(24, createSeededRandom(43117))
const replicates = ref(0)
const observedMean = ref(mean(initialSample))
const standardError = ref(bootstrapMeanStandardError(initialSample))
const lower = ref(Number.NaN)
const upper = ref(Number.NaN)
const uniqueValues = ref(0)
const complete = ref(false)
const started = ref(false)
const failed = ref(false)
const visible = ref(true)
const manuallyStarted = ref(false)
const pausedByUser = ref(false)
const { reduced, resolved } = useReducedMotion()
let handle: BootstrapHandle | null = null
let observer: IntersectionObserver | null = null

const intervalLabel = computed(() =>
  Number.isFinite(lower.value) ? `[${lower.value.toFixed(3)}, ${upper.value.toFixed(3)}]` : 'collecting…',
)

async function start(manual = false) {
  if (manual) manuallyStarted.value = true
  started.value = true
  failed.value = false
  await nextTick()
  if (!canvas.value || handle) return
  try {
    handle = mountBootstrap(canvas.value, {
      onStatsUpdate: (stats) => {
        replicates.value = stats.replicates
        observedMean.value = stats.observedMean
        standardError.value = stats.standardError
        lower.value = stats.interval.lower
        upper.value = stats.interval.upper
        uniqueValues.value = stats.uniqueValues
        complete.value = stats.complete
      },
    })
    handle.setParameters(params.value)
    syncPlayback()
  } catch {
    failed.value = true
    started.value = false
  }
}

function syncPlayback() {
  if (!handle) return
  if (
    document.hidden ||
    !visible.value ||
    pausedByUser.value ||
    complete.value ||
    (reduced.value && !manuallyStarted.value)
  )
    handle.pause()
  else handle.resume()
}

function togglePlayback() {
  pausedByUser.value = !pausedByUser.value
  syncPlayback()
}

function replay() {
  pausedByUser.value = false
  handle?.reset()
  syncPlayback()
}

function regenerate() {
  pausedByUser.value = false
  handle?.regenerate()
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
  document.addEventListener('visibilitychange', syncPlayback)
})

watch(
  resolved,
  (ready) => {
    if (ready && !reduced.value) void start()
  },
  { immediate: true },
)
watch(reduced, syncPlayback)
watch(
  params,
  (value) => {
    handle?.setParameters(value)
    syncPlayback()
  },
  { deep: true },
)

onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('visibilitychange', syncPlayback)
  handle?.destroy()
  handle = null
})
</script>

<template>
  <figure ref="figure" aria-describedby="bootstrap-caption" class="w-full min-w-0 max-w-full">
    <div class="rule-top rule-bottom grid min-w-0 overflow-hidden bg-bg lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div class="relative min-h-[38rem] min-w-0 bg-bg sm:min-h-[34rem]">
        <picture v-if="!started || failed" class="absolute inset-0 block h-full w-full">
          <source media="(max-width: 619px)" srcset="/pieces/bootstrap/preview-mobile.svg" />
          <img
            src="/pieces/bootstrap/preview.svg"
            width="900"
            height="600"
            alt="An orange observed sample above a navy resample, beside a histogram of bootstrap sample means and its 95% interval."
            class="h-full w-full object-contain"
          />
        </picture>
        <canvas
          v-show="started && !failed"
          ref="canvas"
          role="img"
          aria-label="Repeated samples drawn with replacement from observed orange values accumulate into a navy bootstrap distribution of sample means."
          class="absolute inset-0 h-full w-full"
        />
        <button
          v-if="resolved && reduced && !started"
          type="button"
          class="absolute inset-x-0 bottom-4 mx-auto min-h-11 w-fit border border-posterior bg-bg px-4 py-2 font-sans text-xs uppercase tracking-widest text-ink active:translate-y-px"
          @click="start(true)"
        >
          Run resampling
        </button>
        <p v-if="failed" class="absolute inset-x-4 bottom-4 bg-bg p-2 text-center font-sans text-xs text-muted">
          Canvas rendering is unavailable. The static figure shows the same resampling procedure.
        </p>
      </div>

      <aside class="flex min-w-0 flex-col border-rule p-4 lg:border-l" aria-label="Bootstrap controls">
        <label class="block">
          <span class="flex items-baseline justify-between gap-3">
            <span class="font-serif italic">Sample size n</span>
            <output class="font-mono text-xs tnum">{{ params.sampleSize }}</output>
          </span>
          <span class="block font-sans text-xs text-muted">Changing n draws a new observed sample.</span>
          <input
            v-model.number="params.sampleSize"
            aria-label="Observed sample size n"
            type="range"
            :min="BOOTSTRAP_LIMITS.sampleSize.min"
            :max="BOOTSTRAP_LIMITS.sampleSize.max"
            step="1"
            class="bootstrap-range mt-2 w-full"
          />
        </label>

        <label class="mt-5 block">
          <span class="flex items-baseline justify-between gap-3">
            <span class="font-serif italic">Resamples per second</span>
            <output class="font-mono text-xs tnum">{{ params.speed }}</output>
          </span>
          <span class="block font-sans text-xs text-muted">Up to 2,000 bootstrap replicates.</span>
          <input
            v-model.number="params.speed"
            aria-label="Bootstrap resamples per second"
            type="range"
            :min="BOOTSTRAP_LIMITS.speed.min"
            :max="BOOTSTRAP_LIMITS.speed.max"
            step="1"
            class="bootstrap-range mt-2 w-full"
          />
        </label>

        <dl class="mt-6 space-y-3 border-t border-rule pt-4 text-xs">
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Replicates B</dt>
            <dd class="font-mono text-ink tnum">{{ replicates }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Sample mean</dt>
            <dd class="flex items-center gap-2 font-mono text-ink tnum">
              <span aria-hidden="true" class="inline-block size-2 rounded-full bg-observed"></span>
              {{ observedMean.toFixed(3) }}
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Bootstrap SE</dt>
            <dd class="font-mono text-posterior tnum">{{ standardError.toFixed(3) }}</dd>
          </div>
          <div class="flex flex-col gap-1">
            <dt class="text-muted">95% percentile interval</dt>
            <dd class="font-mono text-posterior tnum">{{ intervalLabel }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Distinct in last draw</dt>
            <dd class="font-mono text-ink tnum">{{ uniqueValues }} / {{ params.sampleSize }}</dd>
          </div>
        </dl>

        <div v-if="started && !failed" class="mt-6 grid gap-2 lg:mt-auto">
          <button
            type="button"
            :aria-pressed="pausedByUser"
            :disabled="complete"
            class="min-h-11 border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink hover:border-posterior active:translate-y-px disabled:cursor-default disabled:text-muted"
            @click="togglePlayback"
          >
            {{ complete ? 'Resampling complete' : pausedByUser ? 'Resume resampling' : 'Pause resampling' }}
          </button>
          <button
            type="button"
            class="min-h-11 border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink hover:border-posterior active:translate-y-px"
            @click="replay"
          >
            Replay resampling
          </button>
          <button
            type="button"
            class="min-h-11 border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink hover:border-posterior active:translate-y-px"
            @click="regenerate"
          >
            New sample
          </button>
        </div>
      </aside>
    </div>

    <figcaption id="bootstrap-caption" class="mt-3 max-w-[65ch] text-sm text-muted">
      Each navy resample contains <span class="font-serif italic">n</span> draws with replacement from the orange
      observed sample. Its mean adds one bar to the bootstrap distribution. Repetition is expected: some observed values
      appear several times while others are absent.
    </figcaption>
  </figure>
</template>

<style scoped>
.bootstrap-range {
  accent-color: var(--color-posterior);
  min-height: 2.75rem;
}
</style>
