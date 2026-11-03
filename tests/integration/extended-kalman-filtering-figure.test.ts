import { expect, it, vi } from 'vitest'
import { createRecord, DEFAULT_SETTINGS } from '../../pieces/extended-kalman-filtering/model'
import { renderFigure } from '../../pieces/extended-kalman-filtering/figure'
import { mountExtendedKalman } from '../../pieces/extended-kalman-filtering/simulation'

it('plays each measurement, holds and loops, pauses offscreen and hidden, and cancels stale frames', () => {
  const frames = new Map<number, FrameRequestCallback>()
  let id = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  let intersection: IntersectionObserverCallback | undefined
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionObserverCallback) {
        intersection = cb
      }
      observe() {}
      disconnect() {}
    },
  )
  let hidden = false
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  const playback = vi.fn()
  const host = document.createElement('div')
  const handle = mountExtendedKalman(host, { ...DEFAULT_SETTINGS, inspect: 239 }, vi.fn(), playback)
  const advance = (time: number) => {
    const [key, cb] = [...frames.entries()][0]!
    frames.delete(key)
    cb(time)
  }
  handle.resume()
  handle.resume()
  expect(frames.size).toBe(1)
  advance(0)
  advance(100)
  expect(playback).toHaveBeenLastCalledWith(240, true)
  for (let i = 2; i <= 18; i++) advance(i * 100)
  expect(playback.mock.lastCall![0]).toBeLessThan(10)
  const notifyIntersection = intersection as unknown as (entries: Partial<IntersectionObserverEntry>[]) => void
  notifyIntersection([{ isIntersecting: false }])
  expect(frames.size).toBe(0)
  notifyIntersection([{ isIntersecting: true }])
  expect(frames.size).toBe(1)
  hidden = true
  document.dispatchEvent(new Event('visibilitychange'))
  expect(frames.size).toBe(0)
  hidden = false
  document.dispatchEvent(new Event('visibilitychange'))
  expect(frames.size).toBe(1)
  handle.setSettings({ ...DEFAULT_SETTINGS, inspect: 50 })
  expect(frames.size).toBe(0)
  expect(playback).toHaveBeenLastCalledWith(50, false)
  handle.resume()
  handle.restart()
  expect(playback).toHaveBeenLastCalledWith(1, true)
  const stale = [...frames.values()][0]!
  handle.destroy()
  stale(5000)
  handle.resume()
  handle.pause()
  handle.restart()
  expect(frames.size).toBe(0)
  expect(host.innerHTML).toBe('')
})

it('renders finite accessible figures on both layouts at uncertainty extremes', () => {
  for (const mobile of [false, true])
    for (const uncertainty of [0.05, 1.2]) {
      const settings = { ...DEFAULT_SETTINGS, uncertainty, angle: 2.6 }
      const svg = renderFigure(createRecord(settings), settings, mobile)
      expect(svg).not.toMatch(/NaN|Infinity|undefined/)
      expect(svg).toContain('role="img" aria-labelledby="ekf-title ekf-desc"')
      expect(svg).toContain('pointwise 95% angle interval')
      expect(svg).toContain(`viewBox="0 0 ${mobile ? '440 660' : '900 610'}"`)
      const host = document.createElement('div')
      host.innerHTML = svg
      const curve = host.querySelector('g path')!.getAttribute('d')!
      expect(curve).toMatch(/^M52\.00 /)
      expect(curve).toMatch(new RegExp(`L${mobile ? 420 : 880}\\.00 [\\d.-]+$`))
    }
})

it('disconnects observers over three lifecycles and ignores stale callbacks', () => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  const observers: { draw: () => void; disconnect: ReturnType<typeof vi.fn> }[] = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect = vi.fn()
      constructor(draw: () => void) {
        observers.push({ draw, disconnect: this.disconnect })
      }
      observe() {}
    },
  )
  for (let i = 0; i < 3; i++) {
    const host = document.createElement('div')
    const report = vi.fn()
    const handle = mountExtendedKalman(host, DEFAULT_SETTINGS, report)
    const record = report.mock.lastCall![0]
    handle.setSettings({ ...DEFAULT_SETTINGS, inspect: 50 })
    expect(report.mock.lastCall![0]).toBe(record)
    handle.setSettings({ ...DEFAULT_SETTINGS, seed: 43 })
    expect(report.mock.lastCall![0]).not.toBe(record)
    expect(host.querySelector('svg')).not.toBeNull()
    const count = report.mock.calls.length
    handle.destroy()
    observers[i]!.draw()
    handle.setSettings(DEFAULT_SETTINGS)
    expect(observers[i]!.disconnect).toHaveBeenCalledOnce()
    expect(report).toHaveBeenCalledTimes(count)
    expect(host.innerHTML).toBe('')
  }
})
