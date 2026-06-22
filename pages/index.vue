<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { formatMonth } from '~/utils/date'
import { useReducedMotion } from '~/composables/useReducedMotion'

const { data: pieces } = await useAsyncData('home-pieces', () =>
  queryCollection('pieces').order('published', 'DESC').all(),
)

useHead({ title: 'Aruodore' })

const reduced = useReducedMotion()

function applyMotionPreference() {
  const videos = document.querySelectorAll<HTMLVideoElement>('[data-preview-video]')
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
    <section class="prose-column">
      <h1 class="font-serif text-4xl tracking-tight">Aruodore</h1>
      <p class="mt-3 text-muted text-lg">
        A mathematician and statistician building systems that reason under
        uncertainty.
      </p>
    </section>

    <section class="mt-20">
      <h2 class="font-serif text-xl italic text-muted mb-8">Pieces</h2>

      <ul v-if="pieces && pieces.length" class="space-y-12">
        <li
          v-for="(p, i) in pieces"
          :key="p.path"
          class="grid grid-cols-[auto_1fr] gap-6 items-start"
        >
          <NuxtLink
            :to="p.path"
            tabindex="-1"
            aria-hidden="true"
            class="block w-32 aspect-square bg-rule/50 no-underline overflow-hidden"
          >
            <video
              v-if="p.preview_video"
              :src="p.preview_video"
              :poster="p.preview_image"
              muted
              loop
              playsinline
              preload="metadata"
              data-preview-video
              class="w-full h-full object-cover"
            />
            <img
              v-else-if="p.preview_image"
              :src="p.preview_image"
              alt=""
              loading="lazy"
              decoding="async"
              class="w-full h-full object-cover"
            />
          </NuxtLink>
          <div>
            <p
              class="font-sans text-xs tnum"
              :class="i === 0 ? 'text-observed' : 'text-muted'"
            >
              {{ formatMonth(p.published) }}
            </p>
            <h3 class="mt-1 font-serif text-2xl">
              <NuxtLink :to="p.path" class="no-underline">
                {{ p.title }}
              </NuxtLink>
            </h3>
            <p class="mt-2 text-muted">{{ p.summary }}</p>
          </div>
        </li>
      </ul>

      <p v-else class="text-muted">No pieces yet.</p>
    </section>
  </article>
</template>
