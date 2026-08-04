import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrnsteinUhlenbeck from '../../components/pieces/ornstein-uhlenbeck.vue'

const mocks = vi.hoisted(() => ({
  reduced: { value: false as boolean, __v_isRef: true },
  resolved: { value: true as boolean, __v_isRef: true },
  reset: vi.fn(),
  setParameters: vi.fn(),
  mountSimulation: vi.fn(),
}))

vi.mock('../../composables/use-reduced-motion', () => ({
  useReducedMotion: () => ({ reduced: mocks.reduced, resolved: mocks.resolved }),
}))
vi.mock('../../pieces/ornstein-uhlenbeck/simulation', () => ({ mountOrnsteinUhlenbeck: mocks.mountSimulation }))

describe('ornstein-uhlenbeck', () => {
  beforeEach(() => {
    mocks.reduced.value = false
    mocks.resolved.value = true
    mocks.reset.mockReset()
    mocks.setParameters.mockReset()
    mocks.mountSimulation.mockReset().mockImplementation((_element, options) => {
      options.onStatsUpdate({ elapsed: 2, empiricalVariance: 0.8, stationaryVariance: 1 })
      return {
        pause: vi.fn(),
        resume: vi.fn(),
        reset: mocks.reset,
        setParameters: mocks.setParameters,
        destroy: vi.fn(),
      }
    })
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
    Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined })
  })

  it('labels parameters, updates the live process, and preserves values in full screen', async () => {
    const wrapper = mount(OrnsteinUhlenbeck, { attachTo: document.body })
    await flushPromises()
    expect(wrapper.text()).toContain('Strength of mean reversion')
    expect(wrapper.text()).toContain('Size of random disturbances')
    expect(wrapper.text()).toContain('Equilibrium location')
    const theta = wrapper.get('input[aria-label="Mean reversion strength theta"]')
    await theta.setValue('1.25')
    expect(mocks.setParameters).toHaveBeenLastCalledWith(expect.objectContaining({ theta: 1.25 }))
    const enter = wrapper.findAll('button').find((button) => button.text().includes('Enter full screen'))!
    await enter.trigger('click')
    await flushPromises()
    const handle = wrapper.get('[aria-controls="ou-sheet-content"]')
    expect(handle.attributes('aria-expanded')).toBe('false')
    await handle.trigger('click')
    expect(handle.attributes('aria-expanded')).toBe('true')
    expect(
      (wrapper.findAll('input[aria-label="Mean reversion strength theta"]')[1]!.element as HTMLInputElement).value,
    ).toBe('1.25')
  })

  it('shows the static fallback when WebGL fails', async () => {
    mocks.mountSimulation.mockImplementation(() => {
      throw new Error('WebGL')
    })
    const wrapper = mount(OrnsteinUhlenbeck)
    await flushPromises()
    expect(wrapper.text()).toContain('WebGL is unavailable')
  })
})
