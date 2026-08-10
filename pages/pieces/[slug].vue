<script setup lang="ts">
import { formatDay } from '~/utils/date'
import { SITE_AUTHOR } from '~/utils/identity'
import { defineAsyncComponent } from 'vue'

const route = useRoute()
const slug = computed(() => String(route.params.slug))
const siteUrl = 'https://aruodore.com'

const { data: piece } = await useAsyncData(`piece-${slug.value}`, () =>
  queryCollection('pieces').path(`/pieces/${slug.value}`).first(),
)

if (!piece.value) {
  throw createError({ statusCode: 404, statusMessage: 'Piece not found' })
}

const jsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': ['Article', 'LearningResource'],
  headline: piece.value!.citation_title,
  description: piece.value!.summary,
  url: piece.value!.canonical_url,
  mainEntityOfPage: piece.value!.canonical_url,
  author: { '@type': 'Person', name: piece.value!.author, url: `${siteUrl}/about` },
  publisher: { '@type': 'Organization', name: 'Aruodore', url: `${siteUrl}/` },
  datePublished: piece.value!.published,
  dateModified: piece.value!.modified,
  version: piece.value!.version,
  image: piece.value!.preview_image ? `${siteUrl}${piece.value!.preview_image}` : undefined,
  keywords: piece.value!.math_topics,
  learningResourceType: 'Interactive simulation',
  interactivityType: 'active',
  isAccessibleForFree: true,
  license: piece.value!.license_url,
  codeRepository: piece.value!.source_url,
  inLanguage: 'en',
}))

useHead(() => ({
  title: `${piece.value!.citation_title} | Aruodore`,
  link: [{ rel: 'canonical', href: piece.value!.canonical_url }],
  meta: [
    { name: 'description', content: piece.value!.summary },
    { name: 'author', content: piece.value!.author },
    { name: 'citation_title', content: piece.value!.citation_title },
    {
      name: 'citation_author',
      content: piece.value!.author === SITE_AUTHOR.fullName ? SITE_AUTHOR.citationName : piece.value!.author,
    },
    { name: 'citation_publication_date', content: piece.value!.published },
    { name: 'citation_online_date', content: piece.value!.published },
    { name: 'citation_fulltext_html_url', content: piece.value!.canonical_url },
    ...(piece.value!.doi ? [{ name: 'citation_doi', content: piece.value!.doi }] : []),
    { property: 'og:type', content: 'article' },
    { property: 'og:site_name', content: 'Aruodore' },
    { property: 'og:title', content: piece.value!.citation_title },
    { property: 'og:description', content: piece.value!.summary },
    { property: 'og:url', content: piece.value!.canonical_url },
    ...(piece.value!.preview_image
      ? [{ property: 'og:image', content: `${siteUrl}${piece.value!.preview_image}` }]
      : []),
    { property: 'article:published_time', content: piece.value!.published },
    { property: 'article:modified_time', content: piece.value!.modified },
    { name: 'twitter:card', content: 'summary_large_image' },
  ],
  script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(jsonLd.value) }],
}))

// @nuxt/content v3 only auto-resolves components in components/content/. Piece
// mounts live in components/pieces/ per claude.md and are registered here
// explicitly for the MDC renderer. Math is handled by remark-math +
// rehype-katex in the markdown pipeline and needs no component registration.
const mdcComponents = {
  'brownian-motion': defineAsyncComponent(() => import('~/components/pieces/brownian-motion.vue')),
  'ornstein-uhlenbeck': defineAsyncComponent(() => import('~/components/pieces/ornstein-uhlenbeck.vue')),
  'first-passage': defineAsyncComponent(() => import('~/components/pieces/first-passage.vue')),
}
</script>

<template>
  <article v-if="piece" class="wide-column w-full min-w-0">
    <header class="prose-column">
      <h1 class="font-serif text-3xl tracking-tight">{{ piece.title }}</h1>
      <p class="mt-2 text-muted">{{ piece.summary }}</p>
      <p class="mt-3 font-sans text-xs uppercase tracking-widest text-muted tnum">
        Published {{ formatDay(piece.published) }} · v{{ piece.version }}
        <span v-if="piece.source_url"> · <a :href="piece.source_url" rel="noopener">source</a></span>
      </p>
    </header>

    <section
      v-if="piece.learning_objectives?.length"
      class="prose-column mt-8 rule-top pt-5"
      aria-labelledby="objectives-heading"
    >
      <h2 id="objectives-heading" class="font-serif text-lg">What this piece is for</h2>
      <ul class="mt-3 list-disc space-y-1 pl-5 text-sm">
        <li v-for="objective in piece.learning_objectives" :key="objective">{{ objective }}</li>
      </ul>
    </section>

    <!-- The markdown body embeds the interactive component first, then the
         writeup follows. Prose elements are constrained to prose-column
         width via the styles below; the embedded interactive (a <figure>)
         keeps the full wide-column width naturally. -->
    <div class="piece-body mt-10">
      <content-renderer :value="piece" :components="mdcComponents" />
    </div>

    <footer v-if="piece.references?.length" class="prose-column mt-12 rule-top pt-6">
      <h2 class="font-serif text-xl italic text-muted">References</h2>
      <ol class="mt-4 space-y-2 text-sm">
        <li v-for="(r, i) in piece.references" :key="i">
          {{ r.author }} ({{ r.year }}).
          <template v-if="r.kind === 'book'"
            ><em>{{ r.title }}.</em></template
          >
          <template v-else>{{ r.title }}.</template>
          <template v-if="r.venue"
            >{{ ' ' }}<em v-if="r.kind === 'paper'">{{ r.venue }}</em
            ><span v-else>{{ r.venue }}</span
            >.</template
          >
          <template v-if="r.url"
            >{{ ' ' }}<a :href="r.url" rel="noopener">{{ r.url }}</a></template
          >
        </li>
      </ol>
    </footer>

    <section
      v-if="piece.downloads?.length"
      class="prose-column mt-12 rule-top pt-6"
      aria-labelledby="downloads-heading"
    >
      <h2 id="downloads-heading" class="font-serif text-xl">Downloads and source</h2>
      <ul class="mt-4 space-y-3 text-sm">
        <li v-for="download in piece.downloads" :key="download.url">
          <a :href="download.url" download>{{ download.label }}</a>
          <span class="text-muted">
            · {{ download.format }}<template v-if="download.description"> · {{ download.description }}</template></span
          >
        </li>
        <li v-if="piece.source_file_url">
          <a :href="piece.source_file_url" rel="noopener">Read the simulation source</a>
        </li>
      </ul>
    </section>

    <publication-details
      class="prose-column mt-12"
      :title="piece.citation_title"
      :author="piece.author"
      :published="piece.published"
      :modified="piece.modified"
      :version="piece.version"
      :canonical-url="piece.canonical_url"
      :doi="piece.doi"
      :license-url="piece.license_url"
    />
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
.piece-body :deep(p) {
  margin-bottom: 1rem;
}
.piece-body :deep(p),
.piece-body :deep(li) {
  line-height: 1.65;
}
.piece-body :deep(.katex-display) {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-block: 0.25rem;
}
.piece-body :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
}
.piece-body :deep(a),
footer a {
  overflow-wrap: anywhere;
}
.piece-body :deep(ul),
.piece-body :deep(ol) {
  padding-left: 1.25rem;
  list-style: disc;
}
.piece-body :deep(ol) {
  list-style: decimal;
}
.piece-body :deep(code) {
  font-size: 0.9em;
  background: color-mix(in oklab, var(--color-rule) 50%, transparent);
  padding: 0.1em 0.3em;
  border-radius: 2px;
}
</style>
.piece-body { min-width: 0; max-width: 100%; } .piece-body :deep(> div), .piece-body :deep(figure) { min-width: 0;
max-width: 100%; }
