import { readonly, ref, type Ref } from 'vue'

type FullscreenTarget = Ref<HTMLElement | null>

export function useElementFullscreen(target: FullscreenTarget) {
  const isFullscreen = ref(false)
  const isNativeFullscreen = ref(false)
  let entryElement: HTMLElement | null = null
  let previousOverflow = ''
  let listening = false

  function restoreFocus() {
    const element = entryElement
    entryElement = null
    window.setTimeout(() => element?.focus({ preventScroll: true }), 0)
  }

  function leaveFallback() {
    const element = target.value
    if (element) element.removeAttribute('data-fullscreen-fallback')
    document.documentElement.style.overflow = previousOverflow
  }

  function onFullscreenChange() {
    const native = document.fullscreenElement === target.value
    isNativeFullscreen.value = native
    isFullscreen.value = native
    if (!native) restoreFocus()
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isFullscreen.value && !isNativeFullscreen.value) {
      event.preventDefault()
      void exitFullscreen()
    }
  }

  function ensureListeners() {
    if (listening) return
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('keydown', onKeydown)
    listening = true
  }

  async function enterFullscreen() {
    const element = target.value
    if (!element || isFullscreen.value) return
    ensureListeners()
    entryElement = document.activeElement instanceof HTMLElement ? document.activeElement : null

    if (typeof element.requestFullscreen === 'function') {
      try {
        await element.requestFullscreen()
        isNativeFullscreen.value = true
        isFullscreen.value = true
        return
      } catch {
        // A fixed viewport is the intentional fallback when native fullscreen
        // is missing, denied, or unavailable on this device.
      }
    }

    previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    element.setAttribute('data-fullscreen-fallback', '')
    isNativeFullscreen.value = false
    isFullscreen.value = true
  }

  async function exitFullscreen() {
    if (!isFullscreen.value) return
    if (isNativeFullscreen.value && document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    leaveFallback()
    isNativeFullscreen.value = false
    isFullscreen.value = false
    restoreFocus()
  }

  async function toggleFullscreen() {
    if (isFullscreen.value) await exitFullscreen()
    else await enterFullscreen()
  }

  function cleanupFullscreen() {
    if (target.value?.hasAttribute('data-fullscreen-fallback')) leaveFallback()
    if (listening) {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('keydown', onKeydown)
    }
  }

  return {
    isFullscreen: readonly(isFullscreen),
    isNativeFullscreen: readonly(isNativeFullscreen),
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    cleanupFullscreen,
  }
}
