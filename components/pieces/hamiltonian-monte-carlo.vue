<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '~/composables/use-reduced-motion'
import { HMC_LIMITS } from '~/pieces/hamiltonian-monte-carlo/model'
import { mountHamiltonianMonteCarlo, type HmcHandle } from '~/pieces/hamiltonian-monte-carlo/simulation'

const figure = ref<HTMLElement | null>(null),
  canvas = ref<HTMLCanvasElement | null>(null)
const params = ref({ stepSize: 0.16, leapfrogSteps: 16 }),
  draws = ref(0),
  acceptance = ref(0),
  energyError = ref(0),
  started = ref(false),
  failed = ref(false),
  visible = ref(true),
  manuallyStarted = ref(false)
const { reduced, resolved } = useReducedMotion()
let handle: HmcHandle | null = null,
  observer: IntersectionObserver | null = null
const pathLength = computed(() => (params.value.stepSize * params.value.leapfrogSteps).toFixed(2))
async function start(manual = false) {
  if (manual) manuallyStarted.value = true
  started.value = true
  failed.value = false
  await nextTick()
  if (!canvas.value || handle) return
  try {
    handle = mountHamiltonianMonteCarlo(canvas.value, {
      onStatsUpdate: (stats) => {
        draws.value = stats.draws
        acceptance.value = stats.acceptanceRate
        energyError.value = stats.energyError
      },
    })
    handle.setParameters(params.value)
    sync()
  } catch {
    failed.value = true
    started.value = false
  }
}
function sync() {
  if (!handle) return
  if (document.hidden || !visible.value || (reduced.value && !manuallyStarted.value)) handle.pause()
  else handle.resume()
}
onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      visible.value = entry?.isIntersecting ?? true
      sync()
    },
    { threshold: 0.05 },
  )
  if (figure.value) observer.observe(figure.value)
  document.addEventListener('visibilitychange', sync)
})
watch(
  resolved,
  (ready) => {
    if (ready && !reduced.value) void start()
  },
  { immediate: true },
)
watch(reduced, sync)
watch(params, (value) => handle?.setParameters(value), { deep: true })
onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('visibilitychange', sync)
  handle?.destroy()
  handle = null
})
</script>

<template>
  <figure ref="figure" aria-describedby="hamiltonian-monte-carlo-caption" class="w-full min-w-0 max-w-full">
    <div class="rule-top rule-bottom grid min-w-0 overflow-hidden bg-bg lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div class="relative min-h-[29rem] min-w-0 bg-bg sm:min-h-[34rem]">
        <img
          v-if="!started || failed"
          src="/pieces/hamiltonian-monte-carlo/preview.svg"
          width="900"
          height="600"
          alt="A teal Hamiltonian trajectory curves along navy contours of a narrow diagonal Gaussian target; orange dots mark its accepted positions."
          class="absolute inset-0 h-full w-full object-contain"
        />
        <canvas
          v-show="started && !failed"
          ref="canvas"
          role="img"
          aria-label="Hamiltonian Monte Carlo trajectory moving through a correlated Gaussian target with live accepted draws."
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
          Canvas rendering is unavailable. The static figure shows a Hamiltonian trajectory.
        </p>
        <p
          v-if="started && !failed"
          class="pointer-events-none absolute right-6 bottom-2 font-mono text-xs text-muted tnum"
        >
          <span class="font-serif italic">n</span> = {{ draws }}
        </p>
      </div>
      <aside class="flex min-w-0 flex-col border-rule p-4 lg:border-l" aria-label="Hamiltonian Monte Carlo controls">
        <label class="block"
          ><span class="flex items-baseline justify-between gap-3"
            ><span class="font-serif italic">Step size ε</span
            ><output class="font-mono text-xs tnum">{{ params.stepSize.toFixed(2) }}</output></span
          ><span class="block font-sans text-xs text-muted"
            >Larger steps cover ground quickly, but accumulate energy error.</span
          ><input
            v-model.number="params.stepSize"
            aria-label="Leapfrog step size"
            type="range"
            :min="HMC_LIMITS.stepSize.min"
            :max="HMC_LIMITS.stepSize.max"
            step="0.01"
            class="hmc-range mt-2 w-full"
        /></label>
        <label class="mt-5 block"
          ><span class="flex items-baseline justify-between gap-3"
            ><span class="font-serif italic">Leapfrog steps L</span
            ><output class="font-mono text-xs tnum">{{ params.leapfrogSteps }}</output></span
          ><span class="block font-sans text-xs text-muted"
            >Integration time εL = {{ pathLength }}. Changing either control restarts.</span
          ><input
            v-model.number="params.leapfrogSteps"
            aria-label="Number of leapfrog steps"
            type="range"
            :min="HMC_LIMITS.leapfrogSteps.min"
            :max="HMC_LIMITS.leapfrogSteps.max"
            step="1"
            class="hmc-range mt-2 w-full"
        /></label>
        <dl class="mt-6 space-y-3 border-t border-rule pt-4 text-xs">
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Acceptance</dt>
            <dd class="font-mono text-ink tnum">{{ (acceptance * 100).toFixed(1) }}%</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Last energy error</dt>
            <dd class="font-mono text-posterior tnum">{{ energyError.toFixed(3) }}</dd>
          </div>
        </dl>
        <div v-if="started && !failed" class="mt-6 grid gap-2 lg:mt-auto">
          <button
            type="button"
            class="min-h-11 border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink hover:border-posterior active:translate-y-px"
            @click="handle?.reset()"
          >
            Restart chain</button
          ><button
            type="button"
            class="min-h-11 border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink hover:border-posterior active:translate-y-px"
            @click="handle?.regenerate()"
          >
            New seed
          </button>
        </div>
      </aside>
    </div>
    <figcaption id="hamiltonian-monte-carlo-caption" class="mt-3 max-w-[65ch] text-sm text-muted">
      Navy ellipses are a correlated Gaussian target. A teal leapfrog path follows the fictitious Hamiltonian dynamics,
      then an orange point records the Metropolis-corrected draw. A crossed endpoint indicates a rejected proposal. The
      trajectory can travel along the narrow ridge without the random-walk hesitation visible in earlier samplers.
    </figcaption>
  </figure>
</template>
<style scoped>
.hmc-range {
  accent-color: var(--color-posterior);
  min-height: 2.75rem;
}
</style>
