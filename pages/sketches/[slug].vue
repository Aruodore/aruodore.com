<script setup lang="ts">
import { formatDay } from '~/utils/date'

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { data: sketch } = await useAsyncData(`sketch-${slug.value}`, () =>
  queryCollection('sketches').path(`/sketches/${slug.value}`).first(),
)

if (!sketch.value) {
  throw createError({ statusCode: 404, statusMessage: 'Sketch not found' })
}

useHead(() => ({ title: `${sketch.value!.title} · Aruodore` }))
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

    <div class="mt-8 aspect-square bg-rule/40 rule-bottom overflow-hidden">
      <video
        v-if="sketch.preview_clip"
        :src="sketch.preview_clip"
        autoplay
        muted
        loop
        playsinline
        class="w-full h-full object-cover"
      />
    </div>

    <div class="mt-6">
      <Math display :expr="sketch.equation_latex" />
    </div>

    <div class="mt-8 piece-body">
      <ContentRenderer :value="sketch" />
    </div>
  </article>
</template>
