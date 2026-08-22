import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BetaBinomialUpdate from '../../components/pieces/beta-binomial-update.vue'

const mocks = vi.hoisted(() => ({
  reduced: { value: false as boolean, __v_isRef: true },
  resolved: { value: true as boolean, __v_isRef: true },
  reset: vi.fn(),
  regenerate: vi.fn(),
  setParameters: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  mountSimulation: vi.fn(),
  stats: { value: null as ((stats: unknown) => void) | null },
}))

vi.mock('../../composables/use-reduced-motion', () => ({
  useReducedMotion: () => ({ reduced: mocks.reduced, resolved: mocks.resolved }),
}))
vi.mock('../../pieces/beta-binomial-update/simulation', () => ({
  mountBetaBinomialUpdate: mocks.mountSimulation,
}))

describe('beta-binomial-update', () => {
  beforeEach(() => {
    mocks.reduced.value = false
    mocks.resolved.value = true
    for (const fn of [mocks.reset, mocks.regenerate, mocks.setParameters, mocks.pause, mocks.resume]) fn.mockReset()
    mocks.stats.value = null
    mocks.mountSimulation.mockReset().mockImplementation((_canvas: unknown, options: Record<string, unknown>) => {
      mocks.stats.value = options.onStatsUpdate as (stats: unknown) => void
      return {
        pause: mocks.pause,
        resume: mocks.resume,
        reset: mocks.reset,
        regenerate: mocks.regenerate,
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
  })

  it('mounts the experiment and exposes replay controls', async () => {
    const wrapper = mount(BetaBinomialUpdate)
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    const buttons = wrapper.findAll('button')
    await buttons.find((button) => button.text().includes('Replay'))!.trigger('click')
    await buttons.find((button) => button.text().includes('New data'))!.trigger('click')
    expect(mocks.reset).toHaveBeenCalledOnce()
    expect(mocks.regenerate).toHaveBeenCalledOnce()
  })

  it('forwards prior and data-generating parameters to the simulation', async () => {
    const wrapper = mount(BetaBinomialUpdate)
    await flushPromises()
    mocks.setParameters.mockClear()

    await wrapper.get('input[aria-label="Prior alpha, weight on successes"]').setValue('8.5')
    await flushPromises()
    expect(mocks.setParameters).toHaveBeenLastCalledWith({ alpha0: 8.5, beta0: 2, theta: 0.62 })

    await wrapper.get('input[aria-label="True success probability the data are generated with"]').setValue('0.3')
    await flushPromises()
    expect(mocks.setParameters).toHaveBeenLastCalledWith({ alpha0: 8.5, beta0: 2, theta: 0.3 })
  })

  it('renders posterior summaries reported by the simulation', async () => {
    const wrapper = mount(BetaBinomialUpdate)
    await flushPromises()
    mocks.stats.value?.({
      trials: 60,
      successes: 38,
      posteriorMean: 0.625,
      posteriorSd: 0.06,
      interval: { lower: 0.504, upper: 0.739 },
      priorEss: 4,
      posteriorEss: 64,
    })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('38 / 60')
    expect(text).toContain('0.625')
    expect(text).toContain('[0.504, 0.739]')
    expect(text).toContain('4.0 trials')
  })

  it('keeps the static preview for reduced motion until explicitly run', async () => {
    mocks.reduced.value = true
    const wrapper = mount(BetaBinomialUpdate)
    await flushPromises()
    expect(wrapper.get('img').isVisible()).toBe(true)
    expect(wrapper.text()).toContain('Run experiment')
    expect(mocks.mountSimulation).not.toHaveBeenCalled()

    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    // A manual run must not be paused again by the reduced-motion preference.
    expect(mocks.resume).toHaveBeenCalled()
    expect(mocks.pause).not.toHaveBeenCalled()
  })

  it('retains the preview when canvas mounting fails', async () => {
    mocks.mountSimulation.mockImplementation(() => {
      throw new Error('Canvas')
    })
    const wrapper = mount(BetaBinomialUpdate)
    await flushPromises()
    expect(wrapper.text()).toContain('Canvas rendering is unavailable')
    expect(wrapper.get('img').isVisible()).toBe(true)
  })
})
