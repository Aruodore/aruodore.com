import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
  modules: ['@nuxt/content'],

  components: [
    { path: '~/components', pathPrefix: false },
  ],

  ssr: true,
  experimental: {
    payloadExtraction: true,
  },

  css: [
    '~/assets/css/main.css',
    'katex/dist/katex.min.css',
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Aruodore',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Interactive, browser-native work at the intersection of probability, statistical inference, computer vision, and machine learning.',
        },
        { name: 'color-scheme', content: 'light' },
      ],
      link: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    },
  },

  content: {
    build: {
      markdown: {
        toc: { depth: 3, searchDepth: 3 },
        remarkPlugins: {
          'remark-math': {},
        },
        rehypePlugins: {
          'rehype-katex': {
            // Keep MathML output for screen readers (CLAUDE.md §10.5).
            output: 'htmlAndMathml',
            strict: 'ignore',
          },
        },
      },
    },
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/'],
    },
  },
})
