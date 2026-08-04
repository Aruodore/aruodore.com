import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BrownianMotion from '../../components/pieces/brownian-motion.vue'

const mocks = vi.hoisted(() => ({
  reduced: { value: false as boolean, __v_isRef: true },
  resolved: { value: true as boolean, __v_isRef: true },
  reset: vi.fn(),
  mountSimulation: vi.fn(),
}))

vi.mock('../../composables/use-reduced-motion', () => ({
  useReducedMotion: () => ({ reduced: mocks.reduced, resolved: mocks.resolved }),
}))
vi.mock('../../pieces/brownian-motion/simulation', () => ({ mountBrownianMotion: mocks.mountSimulation }))

describe('brownian-motion', () => {
  beforeEach(() => {
    mocks.reduced.value = false
    mocks.resolved.value = true
    mocks.reset.mockReset()
    mocks.mountSimulation
      .mockReset()
      .mockReturnValue({ pause: vi.fn(), resume: vi.fn(), reset: mocks.reset, destroy: vi.fn() })
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
    Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined })
  })

  it('mounts the simulation, exposes guidance, resets, and uses fallback full screen', async () => {
    const wrapper = mount(BrownianMotion, { attachTo: document.body })
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    await wrapper.get('button:nth-of-type(1)').trigger('click')
    expect(mocks.reset).toHaveBeenCalled()
    const enter = wrapper.findAll('button').find((button) => button.text().includes('Enter full screen'))!
    await enter.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-fullscreen-fallback]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Pinch or scroll to zoom')
    wrapper.unmount()
  })

  it('keeps the static preview for reduced motion until manually started', async () => {
    mocks.reduced.value = true
    const wrapper = mount(BrownianMotion)
    await flushPromises()
    expect(wrapper.get('img').isVisible()).toBe(true)
    expect(wrapper.text()).toContain('Run simulation')
    expect(mocks.mountSimulation).not.toHaveBeenCalled()
  })

  it('reports WebGL failure and retains the preview', async () => {
    mocks.mountSimulation.mockImplementation(() => {
      throw new Error('WebGL')
    })
    const wrapper = mount(BrownianMotion)
    await flushPromises()
    expect(wrapper.text()).toContain('WebGL is unavailable')
    expect(wrapper.get('img').isVisible()).toBe(true)
  })
})
