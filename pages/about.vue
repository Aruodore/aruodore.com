<script setup lang="ts">
useHead({ title: 'About · Aruodore' })

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

    <h1 class="font-serif text-3xl tracking-tight">About</h1>

    <p class="mt-6 text-lg leading-relaxed">
      Aruodore is the studio practice of a mathematician and statistician
      working at the intersection of probability theory, statistical
      inference, computer vision, and machine learning. The work is systems
      that reason under uncertainty — most of it shipped quietly as services
      and pipelines; the interactive pieces collected here are its publicly
      visible portion, where equation, simulation, and writeup sit in one
      place.
    </p>

    <p class="mt-4 text-lg leading-relaxed">
      The aim is not novelty. The aim is to make probabilistic reasoning
      visible: posteriors that update, processes that converge, models that
      fail in legible ways. Each piece is built from first principles, sourced
      to the literature, and shipped as a small public artifact.
    </p>

    <p class="mt-6 text-muted clear-both">
      Contact: <a href="mailto:lucasaruodore@gmail.com">lucasaruodore@gmail.com</a>
    </p>
  </article>
</template>
