<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReducedMotion } from '~/composables/useReducedMotion'

const canvas = ref<HTMLCanvasElement | null>(null)
const started = ref(false)
const manuallyStarted = ref(false)
const { reduced, resolved } = useReducedMotion()
let frameId = 0
let resizeObserver: ResizeObserver | null = null
let x = 0
let history: number[] = []
let spare: number | null = null

const theta = 0.8
const mu = 0
const sigma = 0.75
const dt = 1 / 60
const stationarySd = sigma / Math.sqrt(2 * theta)

function normal() {
  if (spare !== null) {
    const value = spare
    spare = null
    return value
  }
  const u = Math.max(Number.EPSILON, Math.random())
  const v = Math.random()
  const radius = Math.sqrt(-2 * Math.log(u))
  spare = radius * Math.sin(2 * Math.PI * v)
  return radius * Math.cos(2 * Math.PI * v)
}

function draw() {
  const el = canvas.value
  if (!el) return
  const ctx = el.getContext('2d')
  if (!ctx) return
  const { width, height } = el.getBoundingClientRect()
  const ratio = Math.min(window.devicePixelRatio, 2)
  if (el.width !== Math.round(width * ratio) || el.height !== Math.round(height * ratio)) {
    el.width = Math.round(width * ratio)
    el.height = Math.round(height * ratio)
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.fillStyle = '#FAFAF7'
  ctx.fillRect(0, 0, width, height)

  const center = height / 2
  const scale = height * 0.22
  const band = stationarySd * scale
  ctx.fillStyle = 'rgba(30, 58, 95, 0.08)'
  ctx.fillRect(0, center - band, width, band * 2)
  ctx.strokeStyle = '#6B6B66'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, center)
  ctx.lineTo(width, center)
  ctx.stroke()

  if (history.length > 1) {
    ctx.strokeStyle = '#C77B3C'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.beginPath()
    history.forEach((value, index) => {
      const px = index / Math.max(1, history.length - 1) * width
      const py = center - value * scale
      if (index === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()
  }
}

function step() {
  const decay = Math.exp(-theta * dt)
  const innovation = sigma * Math.sqrt((1 - Math.exp(-2 * theta * dt)) / (2 * theta))
  x = mu + (x - mu) * decay + innovation * normal()
  const maxPoints = Math.max(180, Math.round((canvas.value?.clientWidth ?? 512) * 0.9))
  history.push(x)
  if (history.length > maxPoints) history.shift()
  draw()
  frameId = requestAnimationFrame(step)
}

async function start(manual = false) {
  if (manual) manuallyStarted.value = true
  started.value = true
  await nextTick()
  cancelAnimationFrame(frameId)
  frameId = requestAnimationFrame(step)
}

onMounted(() => {
  resizeObserver = new ResizeObserver(draw)
  if (canvas.value) resizeObserver.observe(canvas.value)
  draw()
})

watch(resolved, (ready) => {
  if (ready && !reduced.value) start(false)
}, { immediate: true })
watch(reduced, (shouldReduce) => {
  if (shouldReduce && !manuallyStarted.value) cancelAnimationFrame(frameId)
  else if (started.value) start()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
})
</script>

<template>
  <figure aria-describedby="ou-sketch-caption">
    <div class="relative aspect-square rule-top rule-bottom bg-bg">
      <img v-if="!started" src="/sketches/ornstein-uhlenbeck.png" width="512" height="512" alt="An orange Ornstein–Uhlenbeck path fluctuating around its equilibrium inside a navy stationary band." class="absolute inset-0 h-full w-full object-cover">
      <canvas v-show="started" ref="canvas" role="img" aria-label="An orange Ornstein–Uhlenbeck path fluctuates around a horizontal equilibrium line inside its stationary range." class="h-full w-full" />
      <button v-if="resolved && reduced && !started" type="button" class="absolute inset-x-0 bottom-4 mx-auto w-fit min-h-11 border border-posterior bg-bg px-4 py-2 font-sans text-xs uppercase tracking-widest text-ink" @click="start(true)">
        Run sketch
      </button>
    </div>
    <figcaption id="ou-sketch-caption" class="mt-3 font-sans text-xs text-muted">
      One path in orange. The line marks μ = 0; the navy band spans one stationary standard deviation.
    </figcaption>
  </figure>
</template>
