<script setup lang="ts">
import { formatDay } from '~/utils/date'
import { defineAsyncComponent } from 'vue'

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { data: sketch } = await useAsyncData(`sketch-${slug.value}`, () =>
  queryCollection('sketches').path(`/sketches/${slug.value}`).first(),
)

if (!sketch.value) {
  throw createError({ statusCode: 404, statusMessage: 'Sketch not found' })
}

useHead(() => ({ title: `${sketch.value!.title} · Aruodore` }))

const sketchComponents = {
  'ornstein-uhlenbeck': defineAsyncComponent(() => import('~/components/sketches/ornstein-uhlenbeck-sketch.vue')),
}
const liveSketch = computed(() => sketchComponents[slug.value as keyof typeof sketchComponents])
</script>

<template>
  <article v-if="sketch" class="prose-column">
    <header>
      <h1 class="font-serif text-2xl tracking-tight">{{ sketch.title }}</h1>
      <p class="mt-2 text-muted">{{ sketch.one_sentence_description }}</p>
      <p class="mt-2 font-sans text-xs uppercase tracking-widest text-muted tnum">
        {{ sketch.distribution_or_process }} · {{ formatDay(sketch.published) }}
      </p>
    </header>

    <component :is="liveSketch" v-if="liveSketch" class="mt-8" />

    <div class="mt-8 piece-body">
      <content-renderer :value="sketch" />
    </div>
  </article>
</template>

<style scoped>
.piece-body :deep(p),
.piece-body :deep(.math-display) {
  margin-bottom: 1rem;
}
</style>
