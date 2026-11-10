<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useReducedMotion } from '~/composables/use-reduced-motion'
import { mountPlayback } from '~/pieces/inference/playback'
import type { Control, Definition, View } from '~/pieces/inference/types'
const props = defineProps<{ definition: Definition }>()
const figure = ref<HTMLElement | null>(null)
const plot = ref<HTMLElement | null>(null)
const settings = ref({ ...props.definition.defaults })
const view = shallowRef<View | null>(null)
const phaseLabel = ref('')
const displayStats = shallowRef<View['stats']>([])
let animateNext = false,
  lastStats = 0
const mobile = ref(false),
  failed = ref(false),
  running = ref(false)
const { reduced, resolved } = useReducedMotion()
let mounted = false,
  syncing = false
let handle: ReturnType<typeof mountPlayback> | null = null
const id = computed(() => `${props.definition.slug}-caption`)
const buttonClass =
  'min-h-11 border border-rule px-3 py-2 font-sans text-xs text-ink enabled:hover:border-posterior disabled:text-muted'
const maximum = (control: Control) =>
  control.key === 'inspect' && settings.value.cutoff !== undefined
    ? Math.min(control.max, settings.value.cutoff)
    : control.max
const formatted = (control: Control) =>
  `${settings.value[control.key]!.toFixed(control.digits ?? 0)}${control.unit ?? ''}`
function pause() {
  handle?.pause()
}
function compute() {
  if (!mounted) return
  try {
    view.value = props.definition.compute({ ...settings.value })
    failed.value = false
  } catch {
    failed.value = true
    view.value = null
    pause()
  }
}
function start() {
  compute()
  if (view.value) handle?.play()
}
function play() {
  const key = props.definition.playKey,
    control = props.definition.controls.find((c) => c.key === key)!
  if (settings.value[key]! >= maximum(control) || view.value?.complete) settings.value[key] = control.min
  handle?.play()
}
function advance() {
  const key = props.definition.playKey,
    control = props.definition.controls.find((c) => c.key === key)!
  if (settings.value[key]! >= maximum(control) || view.value?.complete) return false
  animateNext = true
  syncing = true
  settings.value = { ...settings.value, [key]: settings.value[key]! + 1 }
  syncing = false
  return !!view.value
}
async function step() {
  pause()
  if (!view.value) compute()
  if (advance()) {
    await nextTick()
    handle?.play(true)
  }
}
watch(
  settings,
  () => {
    if (!syncing) {
      animateNext = false
      pause()
      phaseLabel.value = ''
    }
    for (const control of props.definition.controls) {
      const value = settings.value[control.key]!
      const bounded = Number.isFinite(value)
        ? Math.max(control.min, Math.min(maximum(control), value))
        : props.definition.defaults[control.key]!
      if (value !== bounded) {
        settings.value[control.key] = bounded
        return
      }
    }
    if (view.value) compute()
  },
  { deep: true, flush: 'sync' },
)
watch([resolved, reduced], ([ready, reduce]) => {
  if (ready && mounted && !view.value && !reduce) start()
  if (reduce) pause()
})
watch(
  [view, mobile],
  () => {
    const current = view.value
    displayStats.value = current?.stats ?? []
    handle?.draw(
      current?.render(mobile.value) ?? '',
      animateNext && current?.motion ? (svg) => current.motion!(svg, mobile.value) : undefined,
    )
    animateNext = false
  },
  { flush: 'post' },
)
onMounted(() => {
  mounted = true
  if (!figure.value || !plot.value) return
  handle = mountPlayback(figure.value, {
    plot: plot.value,
    duration: props.definition.duration,
    onProgress(progress) {
      phaseLabel.value = view.value?.phase?.(progress) ?? 'Playing the recorded sequence.'
      const now = performance.now()
      if (progress === 0 || progress === 1 || !running.value || now - lastStats > 80) {
        displayStats.value = view.value?.statsAt?.(progress) ?? view.value?.stats ?? []
        lastStats = now
      }
    },
    onSize: (value) => (mobile.value = value),
    onRunning: (value) => (running.value = value),
    onTick: advance,
  })
  if (resolved.value && !reduced.value) start()
})
onBeforeUnmount(() => {
  mounted = false
  handle?.destroy()
})
</script>

<template>
  <figure ref="figure" class="w-full min-w-0" :aria-describedby="id">
    <p v-if="view?.insight" class="mb-4 max-w-[75ch] text-base leading-relaxed">{{ view.insight }}</p>
    <div class="rule-top rule-bottom">
      <div class="flex flex-wrap gap-3 border-t border-rule py-4">
        <button v-if="!view && resolved" type="button" :class="buttonClass" @click="start">Run interactive</button>
        <button v-if="view" type="button" :class="buttonClass" @click="running ? pause() : play()">
          {{ running ? 'Pause playback' : 'Play sequence' }}
        </button>
        <button
          v-if="view"
          type="button"
          :class="buttonClass"
          :disabled="
            running ||
            view.complete ||
            settings[definition.playKey]! >= maximum(definition.controls.find((c) => c.key === definition.playKey)!)
          "
          @click="step"
        >
          {{ definition.stepLabel ?? 'Advance one update' }}
        </button>
        <button type="button" :class="buttonClass" :disabled="!view" @click="settings = { ...definition.defaults }">
          Reset comparison
        </button>
        <button
          v-if="definition.defaults.seed !== undefined"
          type="button"
          :class="buttonClass"
          :disabled="!view"
          @click="settings.seed! += 1"
        >
          New noise sample
        </button>
        <span
          v-if="view"
          class="self-center font-sans text-xs text-muted"
          role="status"
          :aria-live="running ? 'off' : 'polite'"
          >{{
            running
              ? phaseLabel || 'Preparing the next update.'
              : phaseLabel
                ? `${phaseLabel} · paused`
                : 'Paused. Move a control to inspect the model.'
          }}</span
        >
      </div>
      <div v-if="definition.presets" class="flex flex-wrap gap-2 border-t border-rule py-3">
        <button
          v-for="preset in definition.presets"
          :key="preset.label"
          type="button"
          :class="buttonClass"
          :disabled="!view"
          @click="settings = { ...settings, ...preset.settings }"
        >
          {{ preset.label }}
        </button>
      </div>
      <div v-show="view" ref="plot" class="w-full min-w-0" />
      <picture v-if="!view">
        <source media="(max-width: 619px)" :srcset="`/pieces/${definition.slug}/preview-mobile.svg`" />
        <img
          :src="`/pieces/${definition.slug}/preview.svg`"
          width="900"
          height="600"
          :alt="definition.alt"
          class="block w-full"
        />
      </picture>
      <p v-if="failed" class="py-3 font-sans text-sm text-muted">
        The interactive is unavailable. The static figure shows the same comparison.
      </p>
      <div class="grid gap-x-8 gap-y-2 border-t border-rule py-3 sm:grid-cols-2">
        <label
          v-for="control in definition.controls.filter((c) => !c.advanced)"
          :key="control.key"
          class="block min-w-0 font-sans text-sm"
        >
          <span class="flex justify-between gap-3"
            ><span>{{ control.label }}</span
            ><output class="shrink-0 font-mono tnum">{{ formatted(control) }}</output></span
          >
          <input
            v-model.number="settings[control.key]"
            :aria-label="control.label"
            :aria-valuetext="formatted(control)"
            type="range"
            :min="control.min"
            :max="maximum(control)"
            :step="control.step"
            :disabled="!view"
            class="mt-1 min-h-11 w-full accent-posterior"
          />
        </label>
      </div>
      <details v-if="definition.controls.some((c) => c.advanced)" class="border-t border-rule py-3 font-sans text-sm">
        <summary class="min-h-8 cursor-pointer">Model settings</summary>
        <div class="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <label
            v-for="control in definition.controls.filter((c) => c.advanced)"
            :key="control.key"
            class="block min-w-0"
          >
            <span class="flex justify-between gap-3"
              ><span>{{ control.label }}</span
              ><output class="shrink-0 font-mono tnum">{{ formatted(control) }}</output></span
            >
            <input
              v-model.number="settings[control.key]"
              :aria-label="control.label"
              :aria-valuetext="formatted(control)"
              type="range"
              :min="control.min"
              :max="maximum(control)"
              :step="control.step"
              :disabled="!view"
              class="mt-1 min-h-11 w-full accent-posterior"
            />
          </label>
        </div>
      </details>
      <details v-if="view" class="border-t border-rule py-3 font-sans text-sm">
        <summary class="min-h-8 cursor-pointer">Numerical readout</summary>
        <dl class="mt-3 grid gap-3 sm:grid-cols-2">
          <div v-for="stat in displayStats" :key="stat.label">
            <dt class="text-muted">{{ stat.label }}</dt>
            <dd class="mt-1 font-mono tnum">{{ stat.value }}</dd>
          </div>
        </dl>
      </details>
    </div>
    <figcaption :id="id" class="mt-3 font-sans text-xs leading-relaxed text-muted">
      {{ definition.alt }} Use the step button to follow one update, or move a slider to inspect its result.
    </figcaption>
  </figure>
</template>
