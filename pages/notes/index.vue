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
      Short observations, derivations, and small experiments that do not need a full interactive piece.
    </p>

    <ul v-if="notes && notes.length" class="mt-10 space-y-6 rule-top pt-8">
      <li
        v-for="n in notes"
        :key="n.path"
        class="grid grid-cols-1 sm:grid-cols-[8rem_minmax(0,1fr)] gap-1 sm:gap-4 items-baseline"
      >
        <span class="font-sans text-xs tnum text-muted">
          {{ formatDay(n.published) }}
        </span>
        <h2 class="font-serif text-base font-normal">
          <nuxt-link :to="n.path" class="no-underline">
            {{ n.title }}
          </nuxt-link>
        </h2>
      </li>
    </ul>
    <p v-else class="mt-10 text-muted">No notes yet.</p>
  </article>
</template>
