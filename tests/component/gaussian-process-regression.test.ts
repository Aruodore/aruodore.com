import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GaussianProcessRegression from '../../components/pieces/gaussian-process-regression.vue'

const mocks = vi.hoisted(() => ({
  reduced: { value: false as boolean, __v_isRef: true },
  resolved: { value: true as boolean, __v_isRef: true },
  addObservation: vi.fn(),
  removeLast: vi.fn(),
  clear: vi.fn(),
  restore: vi.fn(),
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
vi.mock('../../pieces/gaussian-process-regression/simulation', () => ({
  mountGaussianProcessRegression: mocks.mountSimulation,
}))

function button(wrapper: ReturnType<typeof mount>, name: string) {
  const match = wrapper.findAll('button').find((candidate) => candidate.text() === name)
  if (!match) throw new Error(`No button named ${name}`)
  return match
}

describe('gaussian process regression', () => {
  beforeEach(() => {
    mocks.reduced.value = false
    mocks.resolved.value = true
    for (const fn of [
      mocks.addObservation,
      mocks.removeLast,
      mocks.clear,
      mocks.restore,
      mocks.setParameters,
      mocks.pause,
      mocks.resume,
      mocks.destroy,
    ]) {
      fn.mockReset()
    }
    mocks.stats.value = null
    mocks.mountSimulation.mockReset().mockImplementation((_canvas: unknown, options: Record<string, unknown>) => {
      mocks.stats.value = options.onStatsUpdate as (stats: Record<string, unknown>) => void
      return {
        pause: mocks.pause,
        resume: mocks.resume,
        addObservation: mocks.addObservation,
        removeLast: mocks.removeLast,
        clear: mocks.clear,
        restore: mocks.restore,
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

  it('mounts, reports posterior diagnostics, and forwards hyperparameters', async () => {
    const wrapper = mount(GaussianProcessRegression)
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('6 / 30')

    mocks.stats.value?.({ observations: 12, logMarginalLikelihood: -14.256, averageSd: 0.2814, full: false })
    await flushPromises()
    expect(wrapper.text()).toContain('12 / 30')
    expect(wrapper.text()).toContain('-14.26')
    expect(wrapper.text()).toContain('0.281')

    mocks.setParameters.mockClear()
    await wrapper.get('input[aria-label="Kernel length scale"]').setValue('2.5')
    await flushPromises()
    expect(mocks.setParameters).toHaveBeenLastCalledWith({ lengthScale: 2.5, noise: 0.2 })
  })

  it('forwards data controls and disables them at the limits', async () => {
    const wrapper = mount(GaussianProcessRegression)
    await flushPromises()

    await button(wrapper, 'Add observation').trigger('click')
    await button(wrapper, 'Remove last').trigger('click')
    await button(wrapper, 'Clear data').trigger('click')
    await button(wrapper, 'Restore initial data').trigger('click')
    expect(mocks.addObservation).toHaveBeenCalledOnce()
    expect(mocks.removeLast).toHaveBeenCalledOnce()
    expect(mocks.clear).toHaveBeenCalledOnce()
    expect(mocks.restore).toHaveBeenCalledOnce()

    mocks.stats.value?.({ observations: 0, logMarginalLikelihood: 0, averageSd: 1, full: false })
    await flushPromises()
    expect(button(wrapper, 'Clear data').attributes('disabled')).toBeDefined()
    expect(button(wrapper, 'Remove last').attributes('disabled')).toBeDefined()

    mocks.stats.value?.({ observations: 30, logMarginalLikelihood: -20, averageSd: 0.2, full: true })
    await flushPromises()
    expect(button(wrapper, 'Add observation').attributes('disabled')).toBeDefined()
  })

  it('lets the visitor pause and resume the sample paths', async () => {
    const wrapper = mount(GaussianProcessRegression)
    await flushPromises()
    mocks.pause.mockClear()
    mocks.resume.mockClear()

    await wrapper.get('button[aria-pressed="false"]').trigger('click')
    expect(mocks.pause).toHaveBeenCalledOnce()
    await wrapper.get('button[aria-pressed="true"]').trigger('click')
    expect(mocks.resume).toHaveBeenCalledOnce()
  })

  it('falls back to the static figure when canvas mounting fails', async () => {
    mocks.mountSimulation.mockImplementation(() => {
      throw new Error('no canvas')
    })
    const wrapper = mount(GaussianProcessRegression)
    await flushPromises()
    expect(wrapper.text()).toContain('Canvas rendering is unavailable')
    expect(wrapper.find('img').exists()).toBe(true)
  })

  it('waits for explicit motion consent and cleans up', async () => {
    mocks.reduced.value = true
    const wrapper = mount(GaussianProcessRegression)
    await flushPromises()
    expect(mocks.mountSimulation).not.toHaveBeenCalled()
    await button(wrapper, 'Run regression').trigger('click')
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    expect(mocks.pause).not.toHaveBeenCalled()
    wrapper.unmount()
    expect(mocks.destroy).toHaveBeenCalledOnce()
  })
})
