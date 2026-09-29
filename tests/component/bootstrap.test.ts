import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Bootstrap from '../../components/pieces/bootstrap.vue'

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
  stats: { value: null as ((stats: Record<string, unknown>) => void) | null },
}))

vi.mock('../../composables/use-reduced-motion', () => ({
  useReducedMotion: () => ({ reduced: mocks.reduced, resolved: mocks.resolved }),
}))
vi.mock('../../pieces/bootstrap/simulation', () => ({ mountBootstrap: mocks.mountSimulation }))

describe('bootstrap', () => {
  beforeEach(() => {
    mocks.reduced.value = false
    mocks.resolved.value = true
    for (const fn of [mocks.reset, mocks.regenerate, mocks.setParameters, mocks.pause, mocks.resume, mocks.destroy]) {
      fn.mockReset()
    }
    mocks.stats.value = null
    mocks.mountSimulation.mockReset().mockImplementation((_canvas: unknown, options: Record<string, unknown>) => {
      mocks.stats.value = options.onStatsUpdate as (stats: Record<string, unknown>) => void
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

  it('mounts, reports bootstrap diagnostics, and forwards controls', async () => {
    const wrapper = mount(Bootstrap)
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    mocks.stats.value?.({
      replicates: 500,
      observedMean: 1.823,
      standardError: 0.141,
      interval: { lower: 1.55, upper: 2.1 },
      uniqueValues: 16,
      complete: false,
    })
    await flushPromises()
    expect(wrapper.text()).toContain('[1.550, 2.100]')
    expect(wrapper.text()).toContain('16 / 24')

    mocks.setParameters.mockClear()
    await wrapper.get('input[aria-label="Observed sample size n"]').setValue('32')
    await flushPromises()
    expect(mocks.setParameters).toHaveBeenLastCalledWith({ sampleSize: 32, speed: 12 })
  })

  it('lets the visitor pause, resume, and replay the resampling', async () => {
    const wrapper = mount(Bootstrap)
    await flushPromises()
    mocks.pause.mockClear()
    mocks.resume.mockClear()

    await wrapper.get('button[aria-pressed="false"]').trigger('click')
    expect(mocks.pause).toHaveBeenCalledOnce()
    await wrapper.get('button[aria-pressed="true"]').trigger('click')
    expect(mocks.resume).toHaveBeenCalledOnce()

    await wrapper.get('button:nth-of-type(2)').trigger('click')
    expect(mocks.reset).toHaveBeenCalledOnce()
  })

  it('marks the finite resampling run as complete', async () => {
    const wrapper = mount(Bootstrap)
    await flushPromises()
    mocks.stats.value?.({
      replicates: 2000,
      observedMean: 1.823,
      standardError: 0.141,
      interval: { lower: 1.55, upper: 2.1 },
      uniqueValues: 16,
      complete: true,
    })
    await flushPromises()

    const button = wrapper.get('button[disabled]')
    expect(button.text()).toContain('Resampling complete')
  })

  it('waits for explicit motion consent and cleans up', async () => {
    mocks.reduced.value = true
    const wrapper = mount(Bootstrap)
    await flushPromises()
    expect(mocks.mountSimulation).not.toHaveBeenCalled()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    wrapper.unmount()
    expect(mocks.destroy).toHaveBeenCalledOnce()
  })
})
