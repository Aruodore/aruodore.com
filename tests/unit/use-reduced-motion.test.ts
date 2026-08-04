import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useReducedMotion } from '../../composables/use-reduced-motion'

describe('useReducedMotion', () => {
  it('resolves the media preference, responds to changes, and cleans up', async () => {
    let listener: (() => void) | undefined
    const media = {
      matches: true,
      addEventListener: vi.fn((_name, callback) => {
        listener = callback
      }),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    )
    let state!: ReturnType<typeof useReducedMotion>
    const wrapper = mount(
      defineComponent({
        setup() {
          state = useReducedMotion()
          return () => null
        },
      }),
    )
    expect(state.resolved.value).toBe(true)
    expect(state.reduced.value).toBe(true)
    media.matches = false
    listener?.()
    await nextTick()
    expect(state.reduced.value).toBe(false)
    wrapper.unmount()
    expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    listener?.()
    expect(state.reduced.value).toBe(false)
  })
})
