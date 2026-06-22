<script setup lang="ts">
import { formatDay } from '~/utils/date'
import BrownianMotion from '~/components/pieces/BrownianMotion.vue'

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { data: piece } = await useAsyncData(`piece-${slug.value}`, () =>
  queryCollection('pieces').path(`/pieces/${slug.value}`).first(),
)

if (!piece.value) {
  throw createError({ statusCode: 404, statusMessage: 'Piece not found' })
}

useHead(() => ({
  title: `${piece.value!.title} · Aruodore`,
  meta: [{ name: 'description', content: piece.value!.summary }],
}))

// @nuxt/content v3 only auto-resolves components in components/content/. Piece
// mounts live in components/pieces/ per CLAUDE.md §6 and are registered here
// explicitly for the MDC renderer. Math is handled by remark-math +
// rehype-katex in the markdown pipeline and needs no component registration.
const mdcComponents = {
  BrownianMotion,
}
</script>

<template>
  <article v-if="piece" class="wide-column">
    <header class="prose-column">
      <h1 class="font-serif text-3xl tracking-tight">{{ piece.title }}</h1>
      <p class="mt-2 text-muted">{{ piece.summary }}</p>
      <p class="mt-3 font-sans text-xs uppercase tracking-widest text-muted tnum">
        Published {{ formatDay(piece.published) }}
        <span v-if="piece.source_url"> · <a :href="piece.source_url" rel="noopener">source</a></span>
      </p>
    </header>

    <!-- The markdown body embeds the interactive component first, then the
         writeup follows. Prose elements are constrained to prose-column
         width via the styles below; the embedded interactive (a <figure>)
         keeps the full wide-column width naturally. -->
    <div class="piece-body mt-10">
      <ContentRenderer :value="piece" :components="mdcComponents" />
    </div>

    <footer v-if="piece.references?.length" class="prose-column mt-12 rule-top pt-6">
      <h2 class="font-serif text-xl italic text-muted">References</h2>
      <ol class="mt-4 space-y-2 text-sm">
        <li v-for="(r, i) in piece.references" :key="i">
          {{ r.author }} ({{ r.year }}).
          <template v-if="r.kind === 'book'"><em>{{ r.title }}.</em></template>
          <template v-else>{{ r.title }}.</template>
          <template v-if="r.venue">{{ ' ' }}<em v-if="r.kind === 'paper'">{{ r.venue }}</em><span v-else>{{ r.venue }}</span>.</template>
          <template v-if="r.url">{{ ' ' }}<a :href="r.url" rel="noopener">{{ r.url }}</a></template>
        </li>
      </ol>
    </footer>
  </article>
</template>

<style scoped>
/* Body container is wide-column; prose elements inside the rendered markdown
   are constrained to prose-column width and centered. The embedded
   interactive (a <figure>) keeps the full wide-column width naturally. */
.piece-body :deep(h2),
.piece-body :deep(h3),
.piece-body :deep(p),
.piece-body :deep(ul),
.piece-body :deep(ol),
.piece-body :deep(blockquote),
.piece-body :deep(.math-display) {
  max-width: var(--container-prose);
  margin-inline: auto;
}
.piece-body :deep(h2) {
  font-size: 1.5rem;
  margin-top: 2.5rem;
  margin-bottom: 0.75rem;
}
.piece-body :deep(h3) {
  font-size: 1.125rem;
  margin-top: 2rem;
  margin-bottom: 0.5rem;
}
.piece-body :deep(p)  { margin-bottom: 1rem; }
.piece-body :deep(ul),
.piece-body :deep(ol) { padding-left: 1.25rem; list-style: disc; }
.piece-body :deep(ol) { list-style: decimal; }
.piece-body :deep(code) {
  font-size: 0.9em;
  background: color-mix(in oklab, var(--color-rule) 50%, transparent);
  padding: 0.1em 0.3em;
  border-radius: 2px;
}
</style>
