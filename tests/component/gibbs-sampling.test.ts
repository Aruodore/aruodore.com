import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GibbsSampling from '../../components/pieces/gibbs-sampling.vue'

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
vi.mock('../../pieces/gibbs-sampling/simulation', () => ({ mountGibbsSampling: mocks.mountSimulation }))

describe('gibbs-sampling', () => {
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

  it('mounts and forwards target correlation', async () => {
    const wrapper = mount(GibbsSampling)
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    mocks.setParameters.mockClear()
    await wrapper.get('input[aria-label="Target correlation rho"]').setValue('0.94')
    await flushPromises()
    expect(mocks.setParameters).toHaveBeenLastCalledWith({ rho: 0.94 })
  })

  it('renders measured and exact diagnostics', async () => {
    const wrapper = mount(GibbsSampling)
    await flushPromises()
    mocks.stats.value?.({
      sweeps: 2000,
      lagOneAutocorrelation: 0.78,
      effectiveSampleSize: 240,
      empiricalCorrelation: 0.874,
      theoreticalEfficiency: 0.12,
      complete: false,
    })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('0.780')
    expect(text).toContain('0.874')
    expect(text).toContain('240')
    expect(text).toContain('120')
  })

  it('supports reduced motion and cleans up', async () => {
    mocks.reduced.value = true
    const wrapper = mount(GibbsSampling)
    await flushPromises()
    expect(mocks.mountSimulation).not.toHaveBeenCalled()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    wrapper.unmount()
    expect(mocks.destroy).toHaveBeenCalledOnce()
  })
})
