<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import {
  mountBrownianMotion,
  type BrownianMotionHandle,
} from '~/pieces/brownian-motion/simulation'

const container = ref<HTMLDivElement | null>(null)
const elapsed = ref(0)
let handle: BrownianMotionHandle | null = null

onMounted(() => {
  if (!container.value) return
  handle = mountBrownianMotion(container.value, {
    onTimeUpdate: (t) => {
      elapsed.value = t
    },
  })
})

onBeforeUnmount(() => {
  handle?.destroy()
  handle = null
})

function reset() {
  handle?.reset()
}
</script>

<template>
  <figure>
    <div
      class="relative w-full bg-bg rule-top rule-bottom"
      style="aspect-ratio: 900 / 600;"
    >
      <div
        ref="container"
        class="absolute inset-0"
        aria-label="Three-dimensional Brownian motion: a cloud of 100,000 independent random walkers expanding outward from the origin."
      />
      <div
        class="pointer-events-none absolute top-3 left-3 font-mono text-xs text-muted tnum"
        aria-live="off"
      >
        <span class="italic font-serif">t</span> = {{ elapsed.toFixed(1) }} s
      </div>
    </div>

    <figcaption class="mt-3 flex flex-wrap items-center justify-between gap-3 font-sans text-xs text-muted">
      <span>100,000 independent walkers in three dimensions. Drag to orbit; scroll to zoom.</span>
      <button
        type="button"
        class="px-3 py-2 min-h-9 text-ink border border-rule hover:border-posterior focus-visible:border-posterior no-underline uppercase tracking-widest"
        @click="reset"
      >
        Reset
      </button>
    </figcaption>
  </figure>
</template>
