import { afterEach, vi } from 'vitest'

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.style.overflow = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
