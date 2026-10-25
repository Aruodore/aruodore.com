import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KalmanFiltering from '../../components/pieces/kalman-filtering.vue'

const mocks = vi.hoisted(() => ({
  reduced: { value: false as boolean, __v_isRef: true },
  resolved: { value: true as boolean, __v_isRef: true },
  restart: vi.fn(),
  setParameters: vi.fn(),
  setOccluder: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  destroy: vi.fn(),
  mountSimulation: vi.fn(),
  stats: { value: null as ((stats: Record<string, unknown>) => void) | null },
}))

vi.mock('../../composables/use-reduced-motion', () => ({
  useReducedMotion: () => ({ reduced: mocks.reduced, resolved: mocks.resolved }),
}))
vi.mock('../../pieces/kalman-filtering/simulation', () => ({
  mountKalmanFiltering: mocks.mountSimulation,
}))

function button(wrapper: ReturnType<typeof mount>, name: string) {
  const match = wrapper.findAll('button').find((candidate) => candidate.text() === name)
  if (!match) throw new Error(`No button named ${name}`)
  return match
}

describe('kalman filtering', () => {
  beforeEach(() => {
    mocks.reduced.value = false
    mocks.resolved.value = true
    for (const fn of [
      mocks.restart,
      mocks.setParameters,
      mocks.setOccluder,
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
        restart: mocks.restart,
        setParameters: mocks.setParameters,
        setOccluder: mocks.setOccluder,
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

  it('mounts, reports tracking errors, and forwards the noise settings', async () => {
    const wrapper = mount(KalmanFiltering)
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    expect(wrapper.get('dl').text()).toContain('64')

    mocks.stats.value?.({ step: 120, filterRmse: 0.1834, measurementRmse: 0.3412, meanNis: 2.1049 })
    await flushPromises()
    const panel = wrapper.get('dl').text()
    expect(panel).toContain('120')
    expect(panel).toContain('0.183')
    expect(panel).toContain('0.341')
    expect(panel).toContain('2.10')

    mocks.setParameters.mockClear()
    await wrapper.get('input[aria-label="Process noise intensity"]').setValue('1.25')
    await flushPromises()
    expect(mocks.setParameters).toHaveBeenLastCalledWith({ processNoise: 1.25, measurementNoise: 0.15 })
    await wrapper.get('input[aria-label="Measurement noise standard deviation"]').setValue('0.6')
    await flushPromises()
    expect(mocks.setParameters).toHaveBeenLastCalledWith({ processNoise: 1.25, measurementNoise: 0.6 })
  })

  it('restarts the tracker and toggles the occluder', async () => {
    const wrapper = mount(KalmanFiltering)
    await flushPromises()
    expect(mocks.setOccluder).toHaveBeenLastCalledWith(true)

    await button(wrapper, 'Restart tracker').trigger('click')
    expect(mocks.restart).toHaveBeenCalledOnce()

    const occluder = button(wrapper, 'Occluder')
    expect(occluder.attributes('aria-pressed')).toBe('true')
    await occluder.trigger('click')
    expect(mocks.setOccluder).toHaveBeenLastCalledWith(false)
    expect(occluder.attributes('aria-pressed')).toBe('false')
  })

  it('lets the visitor pause and resume tracking', async () => {
    const wrapper = mount(KalmanFiltering)
    await flushPromises()
    mocks.pause.mockClear()
    mocks.resume.mockClear()

    await button(wrapper, 'Pause tracking').trigger('click')
    expect(mocks.pause).toHaveBeenCalledOnce()
    await button(wrapper, 'Resume tracking').trigger('click')
    expect(mocks.resume).toHaveBeenCalledOnce()
  })

  it('falls back to the static figure when canvas mounting fails', async () => {
    mocks.mountSimulation.mockImplementation(() => {
      throw new Error('no canvas')
    })
    const wrapper = mount(KalmanFiltering)
    await flushPromises()
    expect(wrapper.text()).toContain('Canvas rendering is unavailable')
    expect(wrapper.find('img').exists()).toBe(true)
  })

  it('waits for explicit motion consent and cleans up', async () => {
    mocks.reduced.value = true
    const wrapper = mount(KalmanFiltering)
    await flushPromises()
    expect(mocks.mountSimulation).not.toHaveBeenCalled()
    await button(wrapper, 'Run filter').trigger('click')
    await flushPromises()
    expect(mocks.mountSimulation).toHaveBeenCalledOnce()
    expect(mocks.pause).not.toHaveBeenCalled()
    wrapper.unmount()
    expect(mocks.destroy).toHaveBeenCalledOnce()
  })
})
