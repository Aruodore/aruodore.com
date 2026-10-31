<script setup lang="ts">
import { computed } from 'vue'
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)

useHead(() => ({
  title: notFound.value ? 'Page not found · Aruodore' : 'Error · Aruodore',
  meta: [{ name: 'robots', content: 'noindex' }],
}))

// The error state persists across client navigation until it is cleared,
// so links clear it and redirect. Their hrefs still work without JavaScript.
function leave(to: string) {
  void clearError({ redirect: to })
}
</script>

<template>
  <nuxt-layout>
    <article class="prose-column">
      <h1 class="font-serif text-3xl tracking-tight">
        {{ notFound ? 'Page not found' : 'Something went wrong' }}
      </h1>
      <p class="mt-6 text-muted">
        {{
          notFound
            ? 'There is no page at this address. It may have been mistyped, or the page may not be published yet.'
            : 'This page could not be displayed. Reloading it may help.'
        }}
      </p>
      <p class="mt-6">
        <a href="/pieces" @click.prevent="leave('/pieces')">Browse all pieces</a>
        or return to the
        <a href="/" @click.prevent="leave('/')">index</a>.
      </p>
    </article>
  </nuxt-layout>
</template>
