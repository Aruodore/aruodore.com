<script setup lang="ts">
useHead({
  title: 'Lucas Aruodore Adomi · About Aruodore',
  link: [{ rel: 'canonical', href: 'https://aruodore.com/about' }],
  meta: [
    { name: 'description', content: 'About Lucas Aruodore Adomi and Aruodore, a public mathematical practice and interactive research notebook.' },
    { name: 'author', content: 'Lucas Aruodore Adomi' },
  ],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Lucas Aruodore Adomi',
      url: 'https://aruodore.com/about',
      sameAs: ['https://github.com/Aruodore'],
      knowsAbout: ['Probability', 'Statistics', 'Stochastic processes', 'Computer vision', 'Machine learning'],
    }),
  }],
})

// A static sample Brownian path. Hand-picked coordinates that wander like an
// honest 2D random walk: small steps, no big jumps, no return to origin.
// The figure is decorative (marginalia), so it gets aria-hidden and no caption.
const path = '50,52 52,49 51,46 54,44 50,43 47,45 45,42 47,39 44,37 46,34 43,32 45,29 42,27 44,24 41,22 43,19 40,17 37,19 35,16 32,18 30,15 27,17 29,20 26,22 23,20 25,23 22,25 19,23 17,26 14,24 16,21 13,19'
</script>

<template>
  <article class="prose-column">
    <svg
      viewBox="0 0 60 60"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      class="hidden md:block float-right ml-8 mt-2 mb-2 w-24 h-24 text-muted"
    >
      <polyline
        :points="path"
        fill="none"
        stroke="currentColor"
        stroke-width="0.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="50" cy="52" r="0.9" fill="var(--color-posterior)" />
    </svg>

    <h1 class="font-serif text-3xl tracking-tight">Lucas Aruodore Adomi</h1>

    <p class="mt-6 text-lg leading-relaxed">
      I am a mathematician and statistician working across probability,
      statistical inference, computer vision, and machine learning. Aruodore
      collects the public part of that practice: interactive pieces in which a
      simulation, its equations, its implementation, and its sources can be
      examined together.
    </p>

    <p class="mt-4 text-lg leading-relaxed">
      I use the browser to make probabilistic reasoning visible. Each piece is
      built from first principles and checked against the literature. Notes
      hold smaller observations that do not yet need a full interactive.
    </p>

    <p class="mt-6 text-muted clear-both">
      Contact: <a href="mailto:lucasaruodore@gmail.com">lucasaruodore@gmail.com</a>
    </p>

    <p class="mt-3 text-muted">
      Source: <a href="https://github.com/Aruodore/aruodore.com" rel="noopener">Aruodore on GitHub</a>
    </p>
  </article>
</template>
