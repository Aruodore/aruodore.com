import tailwindcss from '@tailwindcss/vite'
import { SITE_AUTHOR } from './utils/identity'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
  modules: ['@nuxt/content'],

  components: [{ path: '~/components', pathPrefix: false }],

  ssr: true,
  experimental: {
    payloadExtraction: true,
  },

  css: ['~/assets/css/main.css', 'katex/dist/katex.min.css'],

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
        { name: 'theme-color', content: '#fafaf7' },
      ],
      link: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Aruodore',
            url: 'https://aruodore.com/',
            author: { '@type': 'Person', name: SITE_AUTHOR.fullName, url: SITE_AUTHOR.url },
          }),
        },
      ],
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
            // Keep MathML output for screen readers (claude.md).
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
      routes: ['/', '/sitemap.xml', '/feed.xml'],
    },
  },

  routeRules: {
    '/**': {
      headers: {
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      },
    },
  },
})
