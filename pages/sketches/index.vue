<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useReducedMotion } from '~/composables/useReducedMotion'

const { data: sketches } = await useAsyncData('sketches-index', () =>
  queryCollection('sketches').order('published', 'DESC').all(),
)

useHead({ title: 'Sketches · Aruodore' })

const reduced = useReducedMotion()

function applyMotionPreference() {
  const videos = document.querySelectorAll<HTMLVideoElement>('[data-sketch-video]')
  videos.forEach((v) => {
    if (reduced.value) {
      v.pause()
    } else {
      v.play().catch(() => { /* autoplay rejection is harmless here */ })
    }
  })
}

onMounted(applyMotionPreference)
watch(reduced, applyMotionPreference)
</script>

<template>
  <article>
    <header class="prose-column">
      <h1 class="font-serif text-3xl tracking-tight">Sketches</h1>
      <p class="mt-3 text-muted">
        Small looping statistical visualizations. Hover to animate, click for
        the equation and a short paragraph.
      </p>
    </header>

    <ul
      v-if="sketches && sketches.length"
      class="mt-12 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 rule-top pt-8"
    >
      <li v-for="s in sketches" :key="s.path" class="group">
        <NuxtLink :to="s.path" class="block no-underline">
          <div
            class="aspect-square bg-rule/40 overflow-hidden rule-bottom"
            data-sketch-tile
          >
            <video
              v-if="s.preview_clip"
              :src="s.preview_clip"
              muted
              loop
              playsinline
              preload="metadata"
              data-sketch-video
              class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            />
          </div>
          <h2 class="mt-2 font-serif text-sm font-normal">{{ s.title }}</h2>
          <p class="font-sans text-xs text-muted">
            {{ s.distribution_or_process }}
          </p>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="mt-10 prose-column text-muted">No sketches yet.</p>
  </article>
</template>
