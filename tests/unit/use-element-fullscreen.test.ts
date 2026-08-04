import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useElementFullscreen } from '../../composables/use-element-fullscreen'

function mountComposable() {
  let api!: ReturnType<typeof useElementFullscreen>
  let targetRef!: ReturnType<typeof ref<HTMLElement | null>>
  const wrapper = mount(
    defineComponent({
      setup() {
        const target = ref<HTMLElement | null>(null)
        targetRef = target
        api = useElementFullscreen(target)
        return { target }
      },
      template: '<div ref="target" />',
    }),
    { attachTo: document.body },
  )
  return { api, wrapper, target: wrapper.element as HTMLElement, targetRef }
}

describe('useElementFullscreen', () => {
  it('does nothing without a target and toggles the fallback', async () => {
    const target = ref<HTMLElement | null>(null)
    const api = useElementFullscreen(target)
    await api.enterFullscreen()
    expect(api.isFullscreen.value).toBe(false)
    await api.exitFullscreen()
    api.cleanupFullscreen()

    const mounted = mountComposable()
    await mounted.api.toggleFullscreen()
    expect(mounted.target.hasAttribute('data-fullscreen-fallback')).toBe(true)
    expect(document.documentElement.style.overflow).toBe('hidden')
    await mounted.api.toggleFullscreen()
    expect(mounted.api.isFullscreen.value).toBe(false)
    await mounted.api.enterFullscreen()
    await mounted.api.exitFullscreen()
    mounted.wrapper.unmount()
  })

  it('uses native full screen and reacts to browser exit', async () => {
    const { api, wrapper, target } = mountComposable()
    let fullscreenElement: Element | null = null
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement })
    Object.defineProperty(target, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(() => {
        fullscreenElement = target
        return Promise.resolve()
      }),
    })
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: vi.fn(() => {
        fullscreenElement = null
        document.dispatchEvent(new Event('fullscreenchange'))
        return Promise.resolve()
      }),
    })

    await api.enterFullscreen()
    expect(api.isNativeFullscreen.value).toBe(true)
    document.dispatchEvent(new Event('fullscreenchange'))
    expect(api.isFullscreen.value).toBe(true)
    await api.exitFullscreen()
    expect(api.isFullscreen.value).toBe(false)
    wrapper.unmount()
  })

  it('falls back when native full screen is rejected and Escape restores focus', async () => {
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    const { api, wrapper, target } = mountComposable()
    Object.defineProperty(target, 'requestFullscreen', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('denied')),
    })

    await api.enterFullscreen()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    await nextTick()
    await new Promise((resolve) => window.setTimeout(resolve, 1))
    expect(target.hasAttribute('data-fullscreen-fallback')).toBe(false)
    expect(document.activeElement).toBe(button)
    wrapper.unmount()
  })

  it('cleans fallback state and registered listeners', async () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const { api, wrapper, target } = mountComposable()
    await api.enterFullscreen()
    api.cleanupFullscreen()
    expect(target.hasAttribute('data-fullscreen-fallback')).toBe(false)
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
    ;(wrapper.vm as unknown as { target: HTMLElement | null }).target = null
    api.cleanupFullscreen()
    wrapper.unmount()
  })

  it('restores scroll state when the fallback target disappears', async () => {
    const activeElement = Object.getOwnPropertyDescriptor(Document.prototype, 'activeElement')
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => null })
    const { api, wrapper, targetRef } = mountComposable()

    await api.enterFullscreen()
    targetRef.value = null
    await api.exitFullscreen()

    expect(api.isFullscreen.value).toBe(false)
    expect(document.documentElement.style.overflow).toBe('')
    if (activeElement) Object.defineProperty(document, 'activeElement', activeElement)
    wrapper.unmount()
  })
})
