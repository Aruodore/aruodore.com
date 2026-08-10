import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FirstPassage from '../../components/pieces/first-passage.vue'

const mocks = vi.hoisted(() => ({
  reduced: { value: false as boolean, __v_isRef: true },
  resolved: { value: true as boolean, __v_isRef: true },
  reset: vi.fn(),
  regenerate: vi.fn(),
  setParameters: vi.fn(),
  mountSimulation: vi.fn(),
}))

vi.mock('../../composables/use-reduced-motion', () => ({
  useReducedMotion: () => ({ reduced: mocks.reduced, resolved: mocks.resolved }),
}))
vi.mock('../../pieces/first-passage/simulation', () => ({ mountFirstPassage: mocks.mountSimulation }))

describe('first-passage', () => {
  beforeEach(() => {
    mocks.reduced.value = false
    mocks.resolved.value = true
    mocks.reset.mockReset()
    mocks.regenerate.mockReset()
    mocks.setParameters.mockReset()
    mocks.mountSimulation.mockReset().mockReturnValue({
      pause: vi.fn(),
      resume: vi.fn(),
      reset: mocks.reset,
      regenerate: mocks.regenerate,
      setParameters: mocks.setParameters,
      destroy: vi.fn(),
    })
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
  })

  it('mounts the experiment and exposes replay controls', async () => {
    const wrapper = mount(FirstPassage)
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    const buttons = wrapper.findAll('button')
    await buttons.find((button) => button.text().includes('Replay'))!.trigger('click')
    await buttons.find((button) => button.text().includes('New paths'))!.trigger('click')
    expect(mocks.reset).toHaveBeenCalledOnce()
    expect(mocks.regenerate).toHaveBeenCalledOnce()
  })

  it('keeps the static preview for reduced motion until explicitly run', async () => {
    mocks.reduced.value = true
    const wrapper = mount(FirstPassage)
    await flushPromises()
    expect(wrapper.get('img').isVisible()).toBe(true)
    expect(wrapper.text()).toContain('Run experiment')
    expect(mocks.mountSimulation).not.toHaveBeenCalled()
  })

  it('retains the preview when canvas mounting fails', async () => {
    mocks.mountSimulation.mockImplementation(() => {
      throw new Error('Canvas')
    })
    const wrapper = mount(FirstPassage)
    await flushPromises()
    expect(wrapper.text()).toContain('Canvas rendering is unavailable')
    expect(wrapper.get('img').isVisible()).toBe(true)
  })
})
