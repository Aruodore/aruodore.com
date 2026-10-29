import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KalmanSmoothing from '../../components/pieces/kalman-smoothing.vue'

let disconnect: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect = disconnect
    },
  )
})

describe('smoothing controls', () => {
  it('renders the comparison, clamps the inspected state, and resets', async () => {
    const wrapper = mount(KalmanSmoothing)
    await flushPromises()
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.get('dl').text()).toContain('Filtered position')
    const cutoff = wrapper.get('input[aria-label="Measurements available through"]')
    await cutoff.setValue('20')
    expect(wrapper.get('input[aria-label="Inspect state at"]').attributes('max')).toBe('20')
    expect(wrapper.get('svg desc').text()).toContain('2.0 seconds')
    for (const [label, value] of [
      ['Inspect state at', '10'],
      ['Process noise intensity q', '1'],
      ['Assumed sensor noise r', '0.5'],
    ]) {
      await wrapper.get(`input[aria-label="${label}"]`).setValue(value)
    }
    const gap = wrapper.findAll('button').find((button) => button.text() === 'Measurement gap')!
    await gap.trigger('click')
    expect(gap.attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('svg').text()).toContain('Sensor available throughout')
    const before = wrapper.get('dl').text()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'New noise sample')!
      .trigger('click')
    expect(wrapper.get('dl').text()).not.toBe(before)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Reset comparison')!
      .trigger('click')
    expect(gap.attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('svg desc').text()).toContain('10.0 seconds')
    wrapper.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('preserves the static figure if mounting fails', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor() {
          throw new Error('unavailable')
        }
      },
    )
    const wrapper = mount(KalmanSmoothing)
    await flushPromises()
    expect(wrapper.get('img').attributes('src')).toContain('preview.svg')
    expect(wrapper.text()).toContain('The interactive is unavailable')
    wrapper.unmount()
  })
})

it('keeps reduced-motion visitors still until Play, and supports pause and restart', async () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList)
  const frames = new Map<number, FrameRequestCallback>()
  let id = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame))
  const wrapper = mount(KalmanSmoothing)
  await flushPromises()
  expect(frames.size).toBe(0)
  const play = () => wrapper.findAll('button').find((button) => /Play sequence|Pause playback/.test(button.text()))!
  expect(wrapper.find('svg').exists()).toBe(false)
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Run simulation')!
    .trigger('click')
  await flushPromises()
  expect(play().text()).toBe('Pause playback')
  expect(frames.size).toBe(1)
  await play().trigger('click')
  expect(frames.size).toBe(0)
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Restart playback')!
    .trigger('click')
  expect(frames.size).toBe(1)
  wrapper.unmount()
  expect(frames.size).toBe(0)
})
