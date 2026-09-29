<script setup lang="ts">
import { computed, ref } from 'vue'
import { createBibtex, createCitation } from '~/utils/citation'

const props = defineProps<{
  title: string
  author: string
  published: string
  modified: string
  version: string
  canonicalUrl: string
  doi?: string
  licenseUrl: string
}>()

const copied = ref(false)
const isCitationOpen = ref(false)
const citation = computed(() => createCitation(props))
const bibtex = computed(() => createBibtex(props))

async function copyCitation() {
  await navigator.clipboard.writeText(citation.value)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1800)
}
</script>

<template>
  <section
    class="publication-details min-w-0 max-w-full rule-top"
    :class="{ 'is-open': isCitationOpen }"
  >
    <button
      id="citation-heading"
      type="button"
      class="citation-trigger flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 bg-transparent px-3 py-3 text-left font-sans text-sm text-ink hover:bg-rule/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-posterior"
      :aria-expanded="isCitationOpen"
      aria-controls="citation-panel"
      @click="isCitationOpen = !isCitationOpen"
    >
      <span class="underline decoration-rule underline-offset-4">Cite this piece</span>
      <span class="citation-toggle flex size-7 shrink-0 items-center justify-center border border-rule text-lg" aria-hidden="true"
        >+</span
      >
    </button>
    <div
      id="citation-panel"
      class="citation-panel-grid"
      role="region"
      :aria-labelledby="'citation-heading'"
      :aria-hidden="!isCitationOpen"
      :inert="!isCitationOpen"
    >
      <div class="citation-panel-inner min-w-0 max-w-full">
        <div class="pb-2 pt-2">
          <p class="text-sm">{{ citation }}</p>
          <div class="mt-3 flex flex-wrap items-center gap-3 font-sans text-xs">
            <button
              type="button"
              class="copy-citation min-h-11 border border-rule px-3 py-2 hover:border-posterior"
              @click="copyCitation"
            >
              {{ copied ? 'Copied' : 'Copy citation' }}
            </button>
            <a
              class="inline-flex min-h-11 items-center px-1"
              :href="`data:text/plain;charset=utf-8,${encodeURIComponent(bibtex)}`"
              :download="`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.bib`"
              >Download BibTeX</a
            >
          </div>
          <details class="mt-3 min-w-0 max-w-full text-sm">
            <summary class="flex min-h-11 cursor-pointer items-center font-sans text-xs">View BibTeX</summary>
            <pre class="mt-2 max-w-full overflow-x-auto bg-rule/30 p-3 text-xs"><code>{{ bibtex }}</code></pre>
          </details>
          <dl class="mt-4 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
            <dt class="text-muted">Version</dt>
            <dd>{{ version }}</dd>
            <dt class="text-muted">Published</dt>
            <dd>
              <time :datetime="published">{{ published }}</time>
            </dd>
            <dt class="text-muted">Last revised</dt>
            <dd>
              <time :datetime="modified">{{ modified }}</time>
            </dd>
            <dt class="text-muted">License</dt>
            <dd><a :href="licenseUrl" rel="license">CC BY 4.0</a></dd>
            <template v-if="doi"
              ><dt class="text-muted">DOI</dt>
              <dd>
                <a :href="`https://doi.org/${doi}`">{{ doi }}</a>
              </dd></template
            >
          </dl>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.citation-trigger {
  transition: background-color 160ms ease-out;
}

.citation-panel-grid {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 260ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 160ms ease-out;
}

.citation-panel-inner {
  min-height: 0;
  overflow: hidden;
}

.publication-details.is-open .citation-panel-grid {
  grid-template-rows: 1fr;
  opacity: 1;
}

.citation-toggle {
  transition:
    transform 180ms ease-out,
    border-color 160ms ease-out;
}

.citation-trigger:hover .citation-toggle {
  border-color: var(--color-posterior);
}

.publication-details.is-open .citation-toggle {
  transform: rotate(45deg);
}

@media (prefers-reduced-motion: reduce) {
  .citation-trigger,
  .citation-toggle,
  .citation-panel-grid {
    transition: none;
  }
}
</style>
