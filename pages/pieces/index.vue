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
      Interactive probability and statistics, with the mathematics, sources, and implementation notes kept alongside
      each piece.
    </p>

    <ul v-if="pieces && pieces.length" class="mt-10 space-y-10 rule-top pt-8">
      <li
        v-for="p in pieces"
        :key="p.path"
        class="grid grid-cols-1 sm:grid-cols-[7rem_minmax(0,1fr)] gap-1 sm:gap-6 items-baseline"
      >
        <span class="font-sans text-xs tnum text-muted">
          {{ formatDay(p.published) }}
        </span>
        <nuxt-link :to="p.path" class="no-underline block">
          <h2 class="font-serif text-2xl">{{ p.title }}</h2>
          <p class="mt-1 text-muted">{{ p.summary }}</p>
        </nuxt-link>
      </li>
    </ul>
    <p v-else class="mt-10 text-muted">No pieces yet.</p>
  </article>
</template>
