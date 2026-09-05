import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MetropolisHastings from '../../components/pieces/metropolis-hastings.vue'

const mocks = vi.hoisted(() => ({
  reduced: { value: false as boolean, __v_isRef: true },
  resolved: { value: true as boolean, __v_isRef: true },
  reset: vi.fn(),
  regenerate: vi.fn(),
  setParameters: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  destroy: vi.fn(),
  mountSimulation: vi.fn(),
  stats: { value: null as ((stats: unknown) => void) | null },
}))

vi.mock('../../composables/use-reduced-motion', () => ({
  useReducedMotion: () => ({ reduced: mocks.reduced, resolved: mocks.resolved }),
}))
vi.mock('../../pieces/metropolis-hastings/simulation', () => ({
  mountMetropolisHastings: mocks.mountSimulation,
}))

describe('metropolis-hastings', () => {
  beforeEach(() => {
    mocks.reduced.value = false
    mocks.resolved.value = true
    for (const fn of [mocks.reset, mocks.regenerate, mocks.setParameters, mocks.pause, mocks.resume, mocks.destroy]) {
      fn.mockReset()
    }
    mocks.stats.value = null
    mocks.mountSimulation.mockReset().mockImplementation((_canvas: unknown, options: Record<string, unknown>) => {
      mocks.stats.value = options.onStatsUpdate as (stats: unknown) => void
      return {
        pause: mocks.pause,
        resume: mocks.resume,
        reset: mocks.reset,
        regenerate: mocks.regenerate,
        setParameters: mocks.setParameters,
        destroy: mocks.destroy,
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

  it('mounts the chain and exposes restart controls', async () => {
    const wrapper = mount(MetropolisHastings)
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    const buttons = wrapper.findAll('button')
    await buttons.find((button) => button.text().includes('Restart chain'))!.trigger('click')
    await buttons.find((button) => button.text().includes('New seed'))!.trigger('click')
    expect(mocks.reset).toHaveBeenCalledOnce()
    expect(mocks.regenerate).toHaveBeenCalledOnce()
  })

  it('forwards the proposal width to the simulation', async () => {
    const wrapper = mount(MetropolisHastings)
    await flushPromises()
    mocks.setParameters.mockClear()
    await wrapper.get('input[aria-label="Proposal standard deviation sigma"]').setValue('1.85')
    await flushPromises()
    expect(mocks.setParameters).toHaveBeenLastCalledWith({ proposalSd: 1.85 })
  })

  it('renders the diagnostics reported by the simulation', async () => {
    const wrapper = mount(MetropolisHastings)
    await flushPromises()
    mocks.stats.value?.({
      draws: 2000,
      accepted: 962,
      acceptanceRate: 0.481,
      lagOneAutocorrelation: 0.874,
      effectiveSampleSize: 132,
      chainMean: 0.238,
      targetMean: 0.247,
      complete: false,
    })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('48.1%')
    expect(text).toContain('0.874')
    expect(text).toContain('132')
    // ESS per 1000 draws is 66 at 132 effective draws out of 2000.
    expect(text).toContain('66')
    expect(text).toContain('0.238')
    expect(text).toContain('0.247')
    expect(text).not.toContain('complete')
  })

  it('marks the run complete when the chain reaches its draw cap', async () => {
    const wrapper = mount(MetropolisHastings)
    await flushPromises()
    mocks.stats.value?.({
      draws: 4000,
      accepted: 1900,
      acceptanceRate: 0.475,
      lagOneAutocorrelation: 0.88,
      effectiveSampleSize: 240,
      chainMean: 0.25,
      targetMean: 0.247,
      complete: true,
    })
    await flushPromises()
    expect(wrapper.text()).toContain('complete')
  })

  it('keeps the static preview for reduced motion until explicitly run', async () => {
    mocks.reduced.value = true
    const wrapper = mount(MetropolisHastings)
    await flushPromises()
    expect(wrapper.get('img').isVisible()).toBe(true)
    expect(wrapper.text()).toContain('Run chain')
    expect(mocks.mountSimulation).not.toHaveBeenCalled()

    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    expect(mocks.resume).toHaveBeenCalled()
    expect(mocks.pause).not.toHaveBeenCalled()
  })

  it('retains the preview when canvas mounting fails', async () => {
    mocks.mountSimulation.mockImplementation(() => {
      throw new Error('Canvas')
    })
    const wrapper = mount(MetropolisHastings)
    await flushPromises()
    expect(wrapper.text()).toContain('Canvas rendering is unavailable')
    expect(wrapper.get('img').isVisible()).toBe(true)
  })

  it('destroys the simulation on unmount', async () => {
    const wrapper = mount(MetropolisHastings)
    await flushPromises()
    wrapper.unmount()
    expect(mocks.destroy).toHaveBeenCalledOnce()
  })
})
