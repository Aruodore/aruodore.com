<script setup lang="ts">
const route = useRoute()

useHead(() => ({
  link: [{ rel: 'canonical', href: `https://aruodore.com${route.path === '/' ? '/' : route.path}` }],
}))

const nav = [
  { to: '/', label: 'Index' },
  { to: '/pieces', label: 'Pieces' },
  { to: '/sketches', label: 'Sketches' },
  { to: '/notes', label: 'Notes' },
  { to: '/about', label: 'About' },
]

function isActive(to: string): boolean {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <div class="min-h-dvh grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] bg-bg text-ink">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-bg focus:text-ink focus:border focus:border-rule focus:no-underline font-sans text-xs"
    >
      Skip to content
    </a>

    <header
      class="wide-column w-full min-w-0 px-4 sm:px-6 pt-8 sm:pt-10 pb-2 sm:pb-4 rule-bottom flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
    >
      <nuxt-link to="/" class="font-serif text-xl tracking-tight no-underline"> Aruodore </nuxt-link>
      <nav class="font-sans text-sm text-muted flex flex-wrap -mx-2 sm:mx-0 sm:gap-4">
        <nuxt-link
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :class="[
            'nav-link inline-flex items-center min-h-11 px-2 no-underline hover:text-ink',
            { 'is-active': isActive(item.to) },
          ]"
        >
          {{ item.label }}
        </nuxt-link>
      </nav>
    </header>

    <main id="main" class="wide-column w-full min-w-0 px-4 sm:px-6 py-10 sm:py-12">
      <slot />
    </main>

    <footer class="wide-column w-full min-w-0 px-4 sm:px-6 py-10 mt-12 rule-top font-sans text-xs text-muted">
      <p>&copy; {{ new Date().getFullYear() }} Aruodore</p>
    </footer>
  </div>
</template>

<style scoped>
.nav-link.is-active {
  color: var(--color-ink);
  text-decoration: underline;
  text-decoration-color: var(--color-ink);
  text-decoration-thickness: 1px;
  text-underline-offset: 6px;
}
</style>
