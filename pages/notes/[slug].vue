<script setup lang="ts">
import { formatDay } from '~/utils/date'

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { data: note } = await useAsyncData(`note-${slug.value}`, () =>
  queryCollection('notes').path(`/notes/${slug.value}`).first(),
)

if (!note.value) {
  throw createError({ statusCode: 404, statusMessage: 'Note not found' })
}

useHead(() => ({ title: `${note.value!.title} · Aruodore` }))
</script>

<template>
  <article v-if="note" class="prose-column">
    <header class="rule-bottom pb-6">
      <h1 class="font-serif text-2xl tracking-tight">{{ note.title }}</h1>
      <p class="mt-2 font-sans text-xs uppercase tracking-widest text-muted tnum">
        {{ formatDay(note.published) }}
        <span v-if="note.topics?.length"> · {{ note.topics.join(' · ') }}</span>
      </p>
    </header>

    <div class="mt-8 piece-body">
      <ContentRenderer :value="note" />
    </div>
  </article>
</template>

<style scoped>
.piece-body :deep(h2) {
  font-size: 1.25rem;
  margin-top: 2rem;
  margin-bottom: 0.5rem;
}
.piece-body :deep(p)  { margin-bottom: 1rem; line-height: 1.65; }
.piece-body :deep(ul),
.piece-body :deep(ol) { margin: 1rem 0 1rem 1.25rem; list-style: disc; }
.piece-body :deep(ol) { list-style: decimal; }
.piece-body :deep(blockquote) {
  position: relative;
  padding-left: 2.25rem;
  margin: 1.5rem 0;
  color: var(--color-muted);
  font-style: italic;
}
.piece-body :deep(blockquote)::before {
  content: '\201C';
  position: absolute;
  left: 0;
  top: -0.15em;
  font-size: 2em;
  line-height: 1;
  color: var(--color-rule);
  font-style: normal;
}
</style>
