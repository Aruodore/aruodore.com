<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { formatMonth } from '~/utils/date'
import { useReducedMotion } from '~/composables/useReducedMotion'

const { data: pieces } = await useAsyncData('home-pieces', () =>
  queryCollection('pieces').order('published', 'DESC').limit(8).all(),
)

useHead({ title: 'Aruodore' })

const { reduced, resolved } = useReducedMotion()

function applyMotionPreference() {
  const videos = document.querySelectorAll<HTMLVideoElement>('[data-preview-video]')
  videos.forEach((v) => {
    if (!resolved.value || reduced.value) {
      v.pause()
    } else {
      v.play().catch(() => { /* autoplay rejection is harmless here */ })
    }
  })
}

onMounted(applyMotionPreference)
watch([reduced, resolved], applyMotionPreference)
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
          class="grid grid-cols-[4rem_minmax(0,1fr)] sm:grid-cols-[8rem_minmax(0,1fr)] gap-4 sm:gap-6 items-start"
        >
          <NuxtLink
            :to="p.path"
            tabindex="-1"
            aria-hidden="true"
            class="block w-16 sm:w-32 sm:row-span-2 aspect-square bg-rule/50 no-underline overflow-hidden"
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
              width="512"
              height="512"
              loading="lazy"
              decoding="async"
              class="w-full h-full object-cover"
            />
          </NuxtLink>
          <div>
            <p class="flex items-center gap-2 font-sans text-xs tnum text-muted">
              <span v-if="i === 0" class="newest-marker" aria-hidden="true" />
              <span v-if="i === 0" class="sr-only">Newest: </span>
              {{ formatMonth(p.published) }}
            </p>
            <h3 class="mt-1 font-serif text-2xl">
              <NuxtLink :to="p.path" class="no-underline">
                {{ p.title }}
              </NuxtLink>
            </h3>
          </div>
          <p class="col-span-2 mt-1 text-muted sm:col-start-2 sm:col-span-1">{{ p.summary }}</p>
        </li>
      </ul>

      <p v-else class="text-muted">No pieces yet.</p>
    </section>
  </article>
</template>
