<script setup lang="ts">
const theme = ref<'light' | 'dark'>('light')

function applyTheme(value: 'light' | 'dark') {
  theme.value = value
  document.documentElement.dataset.theme = value
  localStorage.setItem('aruodore-theme', value)
}

function toggleTheme() {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark')
}

onMounted(() => {
  const explicit = document.documentElement.dataset.theme
  const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  theme.value = explicit === 'dark' || explicit === 'light' ? explicit : preferred
})
</script>

<template>
  <button type="button" class="theme-switch" :aria-label="`Use ${theme === 'dark' ? 'light' : 'dark'} theme`" @click="toggleTheme">
    {{ theme === 'dark' ? 'Light' : 'Dark' }}
  </button>
</template>

<style scoped>
.theme-switch {
  min-height: 2.75rem;
  padding: 0 0.5rem;
  border: 0;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 0.82rem;
}

.theme-switch:hover {
  color: var(--color-ink);
}
</style>
