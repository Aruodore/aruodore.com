<script setup lang="ts">
import { formatDay } from '~/utils/date'

const { data: pieces } = await useAsyncData('pieces-index', () =>
  queryCollection('pieces').order('published', 'DESC').all(),
)

useHead({ title: 'Pieces · Aruodore' })
</script>

<template>
  <article class="prose-column">
    <h1 class="font-serif text-3xl tracking-tight">Pieces</h1>
    <p class="mt-3 text-muted">
      Deep interactives. Math visible, source linked, references attached.
    </p>

    <ul v-if="pieces && pieces.length" class="mt-10 space-y-10 rule-top pt-8">
      <li v-for="(p, i) in pieces" :key="p.path" class="grid grid-cols-[7rem_1fr] gap-6 items-baseline">
        <span
          class="font-sans text-xs tnum"
          :class="i === 0 ? 'text-observed' : 'text-muted'"
        >
          {{ formatDay(p.published) }}
        </span>
        <NuxtLink :to="p.path" class="no-underline block">
          <h2 class="font-serif text-2xl">{{ p.title }}</h2>
          <p class="mt-1 text-muted">{{ p.summary }}</p>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="mt-10 text-muted">No pieces yet.</p>
  </article>
</template>
