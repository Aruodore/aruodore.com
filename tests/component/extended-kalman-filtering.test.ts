import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import ExtendedKalman from '../../components/pieces/extended-kalman-filtering.vue'

const disconnect = vi.fn()
beforeEach(() => {
  disconnect.mockClear()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect = disconnect
    },
  )
})
it('inspects updates, changes the experiment, resets and releases the observer', async () => {
  const wrapper = mount(ExtendedKalman)
  await flushPromises()
  expect(wrapper.get('svg desc').text()).toContain('measurement 80')
  await wrapper.get('input[aria-label="Inspect measurement"]').setValue(50)
  expect(wrapper.get('svg desc').text()).toContain('2.50 seconds')
  for (const [label, value] of [
    ['Release angle', '2.4'],
    ['Initial angle uncertainty', '0.7'],
    ['Sensor noise standard deviation', '0.2'],
  ])
    await wrapper.get(`input[aria-label="${label}"]`).setValue(value)
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
  expect(wrapper.get('svg desc').text()).toContain('measurement 1')
  wrapper.unmount()
  expect(disconnect).toHaveBeenCalledOnce()
})
it('retains the static figure if mounting fails', async () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor() {
        throw new Error('unavailable')
      }
    },
  )
  const wrapper = mount(ExtendedKalman)
  await flushPromises()
  expect(wrapper.get('img').attributes('src')).toContain('/extended-kalman-filtering/preview.svg')
  expect(wrapper.text()).toContain('The interactive is unavailable')
  wrapper.unmount()
})

it('autoplays on entry and supports pause, resume and restart', async () => {
  const wrapper = mount(ExtendedKalman)
  await flushPromises()
  const button = () => wrapper.findAll('button').find((b) => /Pause tracking|Resume tracking/.test(b.text()))!
  expect(button().text()).toBe('Pause tracking')
  expect(requestAnimationFrame).toHaveBeenCalledOnce()
  await button().trigger('click')
  expect(button().text()).toBe('Resume tracking')
  await button().trigger('click')
  expect(button().text()).toBe('Pause tracking')
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Restart tracker')!
    .trigger('click')
  wrapper.unmount()
})
it('keeps the preview still for reduced motion until Run filter is pressed', async () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList)
  const wrapper = mount(ExtendedKalman)
  await flushPromises()
  expect(wrapper.find('svg').exists()).toBe(false)
  expect(requestAnimationFrame).not.toHaveBeenCalled()
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Run filter')!
    .trigger('click')
  expect(wrapper.find('svg').exists()).toBe(true)
  expect(requestAnimationFrame).toHaveBeenCalledOnce()
  wrapper.unmount()
})
