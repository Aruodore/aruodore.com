<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useReducedMotion } from '~/composables/use-reduced-motion'
import { BROWNIAN_BRIDGE_LIMITS } from '~/pieces/brownian-bridge/model'
import { mountBrownianBridge, type BrownianBridgeHandle } from '~/pieces/brownian-bridge/simulation'

const canvas = ref<HTMLCanvasElement | null>(null)
const failed = ref(false)
const midpointMean = ref(0.4)
const midpointSd = ref(0.45)
const params = reactive({ endpoint: 0.8, sigma: 0.9 })
const { reduced } = useReducedMotion()
let handle: BrownianBridgeHandle | null = null

onMounted(() => {
  if (!canvas.value) return
  try {
    handle = mountBrownianBridge(canvas.value, {
      onStatsUpdate: (stats) => {
        midpointMean.value = stats.midpointMean
        midpointSd.value = stats.midpointSd
      },
    })
    handle.setReducedMotion(reduced.value)
  } catch {
    failed.value = true
  }
})

watch(params, (value) => handle?.setParameters({ ...value }), { deep: true })
watch(reduced, (value) => handle?.setReducedMotion(value))

onBeforeUnmount(() => {
  handle?.destroy()
  handle = null
})
</script>

<template>
  <figure aria-describedby="brownian-bridge-caption" class="w-full min-w-0 max-w-full">
    <div class="rule-top rule-bottom grid min-w-0 overflow-hidden bg-bg lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div class="relative min-h-[25rem] min-w-0 bg-bg sm:min-h-[34rem]">
        <img
          v-if="failed"
          src="/pieces/brownian-bridge/preview.svg"
          width="900"
          height="600"
          alt="Unconditioned teal Brownian paths beside navy Brownian bridge paths narrowing to an orange endpoint."
          class="absolute inset-0 h-full w-full object-contain"
        />
        <canvas
          v-show="!failed"
          ref="canvas"
          role="img"
          aria-label="Teal Brownian paths have unrestricted endpoints. Paired navy Brownian bridge paths use the same random innovations but narrow to the selected orange endpoint at time one."
          class="absolute inset-0 h-full w-full"
        />
        <p v-if="failed" class="absolute inset-x-4 bottom-4 bg-bg p-2 text-center font-sans text-xs text-muted">
          Canvas rendering is unavailable. The static figure shows the same comparison.
        </p>
      </div>

      <aside class="flex min-w-0 flex-col border-rule p-4 lg:border-l" aria-label="Brownian bridge controls">
        <div class="space-y-5">
          <label class="block">
            <span class="flex items-baseline justify-between gap-3">
              <span class="font-serif italic">Endpoint, b</span>
              <output class="font-mono text-xs text-ink tnum">{{ params.endpoint.toFixed(2) }}</output>
            </span>
            <span class="block font-sans text-xs text-muted">Value fixed at terminal time.</span>
            <input
              v-model.number="params.endpoint"
              aria-label="Terminal endpoint b"
              type="range"
              :min="BROWNIAN_BRIDGE_LIMITS.endpoint.min"
              :max="BROWNIAN_BRIDGE_LIMITS.endpoint.max"
              step="0.05"
              class="bridge-endpoint-range mt-2 w-full"
            />
          </label>
          <label class="block">
            <span class="flex items-baseline justify-between gap-3">
              <span class="font-serif italic">Noise, σ</span>
              <output class="font-mono text-xs tnum">{{ params.sigma.toFixed(2) }}</output>
            </span>
            <span class="block font-sans text-xs text-muted">Unconditioned path spread.</span>
            <input
              v-model.number="params.sigma"
              aria-label="Noise amplitude sigma"
              type="range"
              :min="BROWNIAN_BRIDGE_LIMITS.sigma.min"
              :max="BROWNIAN_BRIDGE_LIMITS.sigma.max"
              step="0.05"
              class="bridge-range mt-2 w-full"
            />
          </label>
        </div>

        <dl class="mt-6 space-y-3 border-t border-rule pt-4 text-xs">
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Midpoint mean</dt>
            <dd class="font-mono text-posterior tnum">{{ midpointMean.toFixed(3) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Midpoint SD</dt>
            <dd class="font-mono text-posterior tnum">{{ midpointSd.toFixed(3) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Terminal SD</dt>
            <dd class="font-mono text-posterior tnum">0.000</dd>
          </div>
        </dl>

        <div v-if="!failed" class="mt-6 grid gap-2 lg:mt-auto">
          <button
            type="button"
            class="min-h-11 border border-rule px-3 py-2 font-sans text-xs uppercase tracking-widest text-ink hover:border-posterior active:translate-y-px"
            @click="handle?.replayConditioning()"
          >
            Replay conditioning
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

    <figcaption id="brownian-bridge-caption" class="mt-3 max-w-[65ch] text-sm text-muted">
      Each navy path uses the same random innovations as one teal path. Conditioning removes the terminal innovation and
      replaces it with the selected orange endpoint; uncertainty therefore narrows to zero at
      <span class="font-serif italic">t</span> = 1.
    </figcaption>
  </figure>
</template>

<style scoped>
.bridge-range {
  accent-color: var(--color-posterior);
  min-height: 2.75rem;
}
.bridge-endpoint-range {
  accent-color: var(--color-observed);
  min-height: 2.75rem;
}
</style>
