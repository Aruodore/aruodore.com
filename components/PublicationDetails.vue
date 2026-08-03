<script setup lang="ts">
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
const citation = computed(() => {
  const year = props.published.slice(0, 4)
  const location = props.doi ? `https://doi.org/${props.doi}` : props.canonicalUrl
  return `${props.author}. “${props.title}.” Aruodore, version ${props.version}, ${year}. ${location}.`
})
const bibtex = computed(() => {
  const keyTitle = props.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const year = props.published.slice(0, 4)
  const doi = props.doi ? `\n  doi       = {${props.doi}},` : ''
  return `@misc{adomi_${keyTitle}_${year},\n  author    = {Adomi, Lucas Aruodore},\n  title     = {${props.title}},\n  year      = {${year}},\n  version   = {${props.version}},\n  publisher = {Aruodore},${doi}\n  url       = {${props.canonicalUrl}},\n  note      = {Interactive mathematical explanation and browser-based simulation}\n}`
})

async function copyCitation() {
  await navigator.clipboard.writeText(citation.value)
  copied.value = true
  window.setTimeout(() => { copied.value = false }, 1800)
}
</script>

<template>
  <section class="publication-details min-w-0 max-w-full rule-top pt-6" aria-labelledby="citation-heading">
    <h2 id="citation-heading" class="font-serif text-xl">How to cite this piece</h2>
    <p class="mt-3 text-sm">{{ citation }}</p>
    <div class="mt-3 flex flex-wrap gap-4 font-sans text-xs">
      <button type="button" class="border border-rule px-3 py-2 hover:border-posterior" @click="copyCitation">
        {{ copied ? 'Copied' : 'Copy citation' }}
      </button>
      <a :href="`data:text/plain;charset=utf-8,${encodeURIComponent(bibtex)}`" :download="`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.bib`">Download BibTeX</a>
    </div>
    <details class="mt-4 min-w-0 max-w-full text-sm">
      <summary class="cursor-pointer font-sans text-xs">BibTeX</summary>
      <pre class="mt-3 max-w-full overflow-x-auto bg-rule/30 p-3 text-xs"><code>{{ bibtex }}</code></pre>
    </details>
    <dl class="mt-5 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
      <dt class="text-muted">Version</dt><dd>{{ version }}</dd>
      <dt class="text-muted">Published</dt><dd><time :datetime="published">{{ published }}</time></dd>
      <dt class="text-muted">Last revised</dt><dd><time :datetime="modified">{{ modified }}</time></dd>
      <dt class="text-muted">License</dt><dd><a :href="licenseUrl" rel="license">CC BY 4.0</a></dd>
      <template v-if="doi"><dt class="text-muted">DOI</dt><dd><a :href="`https://doi.org/${doi}`">{{ doi }}</a></dd></template>
    </dl>
  </section>
</template>
