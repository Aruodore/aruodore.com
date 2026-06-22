<script setup lang="ts">
import { formatDay } from '~/utils/date'

const { data: notes } = await useAsyncData('notes-index', () =>
  queryCollection('notes').order('published', 'DESC').all(),
)

useHead({ title: 'Notes · Aruodore' })
</script>

<template>
  <article class="prose-column">
    <h1 class="font-serif text-3xl tracking-tight">Notes</h1>
    <p class="mt-3 text-muted">
      Paper observations, half-formed ideas, small experiments.
    </p>

    <ul v-if="notes && notes.length" class="mt-10 space-y-6 rule-top pt-8">
      <li v-for="(n, i) in notes" :key="n.path" class="flex items-baseline gap-4">
        <span
          class="font-sans text-xs tnum w-32 shrink-0"
          :class="i === 0 ? 'text-observed' : 'text-muted'"
        >
          {{ formatDay(n.published) }}
        </span>
        <h2 class="font-serif text-base font-normal">
          <NuxtLink :to="n.path" class="no-underline">
            {{ n.title }}
          </NuxtLink>
        </h2>
      </li>
    </ul>
    <p v-else class="mt-10 text-muted">No notes yet.</p>
  </article>
</template>
