import { ref, onMounted, onBeforeUnmount } from 'vue'

/**
 * Reactive `prefers-reduced-motion` query. Returns `false` during SSR (we
 * cannot know the user's preference) and syncs to the media query on mount.
 */
export function useReducedMotion() {
  const reduced = ref(false)
  const resolved = ref(false)
  let mq: MediaQueryList | null = null
  const onChange = () => {
    if (mq) reduced.value = mq.matches
  }

  onMounted(() => {
    mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.value = mq.matches
    resolved.value = true
    mq.addEventListener('change', onChange)
  })

  onBeforeUnmount(() => {
    mq?.removeEventListener('change', onChange)
    mq = null
  })

  return { reduced, resolved }
}
