import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import InferenceFigure from '../../components/pieces/inference-figure.vue'
import type { Definition } from '../../pieces/inference/types'
let resizeCallback: () => void
let intersectionCallback: (entries: { isIntersecting: boolean }[]) => void
let resizeDisconnect: ReturnType<typeof vi.fn>, intersectionDisconnect: ReturnType<typeof vi.fn>
beforeEach(() => {
  resizeDisconnect = vi.fn()
  intersectionDisconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resizeCallback = callback
      }
      observe() {}
      disconnect = resizeDisconnect
    },
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: typeof intersectionCallback) {
        intersectionCallback = callback
      }
      observe() {}
      disconnect = intersectionDisconnect
    },
  )
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 16))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList)
})
const definition = (): Definition => ({
  slug: 'test-figure',
  title: 'Test figure',
  alt: 'Static comparison',
  defaults: { cutoff: 2, inspect: 2 },
  duration: 300,
  playKey: 'cutoff',
  controls: [
    { key: 'cutoff', label: 'Cutoff', min: 0, max: 4, step: 1 },
    { key: 'inspect', label: 'Inspect', min: 0, max: 4, step: 1 },
  ],
  compute: vi.fn((s) => ({
    render: (mobile: boolean) => `<svg role="img"><title>Comparison</title><desc>${s.cutoff} ${mobile}</desc></svg>`,
    stats: [{ label: 'Cutoff value', value: String(s.cutoff) }],
  })),
})
describe('shared inference figure lifecycle', () => {
  it('keeps reduced motion still, advances once, bounds inspection, and cancels observers and late callbacks', async () => {
    vi.useFakeTimers()
    try {
      const d = definition(),
        w = mount(InferenceFigure, { props: { definition: d } })
      await nextTick()
      expect(w.find('svg').exists()).toBe(false)
      expect(w.findAll('button').some((b) => b.text() === 'Pause playback')).toBe(false)
      await w
        .findAll('button')
        .find((b) => b.text() === 'Run interactive')!
        .trigger('click')
      expect(w.find('svg').exists()).toBe(true)
      await vi.advanceTimersByTimeAsync(2000)
      expect(w.get('input[aria-label="Cutoff"]').element).toHaveProperty('value', '4')
      expect(w.findAll('button').some((b) => b.text() === 'Play sequence')).toBe(true)
      await w.get('input[aria-label="Cutoff"]').setValue('1')
      expect(w.get('input[aria-label="Inspect"]').attributes('max')).toBe('1')
      expect(w.get('input[aria-label="Inspect"]').element).toHaveProperty('value', '1')
      await w
        .findAll('button')
        .find((b) => b.text() === 'Play sequence')!
        .trigger('click')
      intersectionCallback([{ isIntersecting: false }])
      const pausedCalls = vi.mocked(d.compute).mock.calls.length
      await vi.advanceTimersByTimeAsync(1000)
      expect(vi.mocked(d.compute).mock.calls.length).toBe(pausedCalls)
      intersectionCallback([{ isIntersecting: true }])
      await vi.advanceTimersByTimeAsync(650)
      expect(vi.mocked(d.compute).mock.calls.length).toBeGreaterThan(pausedCalls)
      w.unmount()
      const calls = vi.mocked(d.compute).mock.calls.length
      resizeCallback()
      intersectionCallback([{ isIntersecting: true }])
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(2000)
      await nextTick()
      expect(vi.mocked(d.compute).mock.calls.length).toBe(calls)
      expect(resizeDisconnect).toHaveBeenCalledOnce()
      expect(intersectionDisconnect).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })
  it('finishes one animated step and pauses without advancing the next update', async () => {
    vi.useFakeTimers()
    try {
      const d = definition()
      d.compute = (settings) => ({
        render: () => '<svg role="img"><title>Animated update</title></svg>',
        motion: (svg) => (progress) => svg.setAttribute('data-progress', String(progress)),
        stats: [{ label: 'Cutoff', value: String(settings.cutoff) }],
      })
      const w = mount(InferenceFigure, { props: { definition: d } })
      await nextTick()
      await w
        .findAll('button')
        .find((b) => b.text() === 'Run interactive')!
        .trigger('click')
      await w
        .findAll('button')
        .find((b) => b.text() === 'Pause playback')!
        .trigger('click')
      await w
        .findAll('button')
        .find((b) => b.text() === 'Advance one update')!
        .trigger('click')
      await vi.advanceTimersByTimeAsync(1000)
      expect(w.get('input[aria-label="Cutoff"]').element).toHaveProperty('value', '3')
      expect(w.get('svg').attributes('data-progress')).toBe('1')
      expect(w.findAll('button').some((b) => b.text() === 'Play sequence')).toBe(true)
      await vi.advanceTimersByTimeAsync(1000)
      expect(w.get('input[aria-label="Cutoff"]').element).toHaveProperty('value', '3')
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
  it('retains the static fallback when computation fails', async () => {
    const d = definition()
    d.compute = () => {
      throw new Error('unavailable')
    }
    const w = mount(InferenceFigure, { props: { definition: d } })
    await nextTick()
    await w
      .findAll('button')
      .find((b) => b.text() === 'Run interactive')!
      .trigger('click')
    expect(w.get('img').attributes('src')).toContain('preview.svg')
    expect(w.text()).toContain('The interactive is unavailable')
    w.unmount()
  })
})
