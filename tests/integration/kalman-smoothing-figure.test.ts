import { describe, expect, it, vi } from 'vitest'
import { createRecord, DEFAULT_SETTINGS } from '../../pieces/kalman-smoothing/model'
import { renderSmoothing } from '../../pieces/kalman-smoothing/figure'
import { mountKalmanSmoothing } from '../../pieces/kalman-smoothing/simulation'

describe('smoothing figure lifecycle', () => {
  it('draws mobile and desktop figures with valid coordinates and accessible descriptions', () => {
    for (const mobile of [false, true])
      for (const cutoff of [0, 45, 100]) {
        const svg = renderSmoothing(createRecord({ ...DEFAULT_SETTINGS, cutoff }), mobile)
        expect(svg).not.toMatch(/NaN|Infinity|undefined/)
        expect(svg).toContain('aria-labelledby="ks-title" aria-describedby="ks-description"')
        expect(svg).toContain('95% intervals')
        expect(svg).toContain('stroke-dasharray="7 5"')
      }
  })

  it('disconnects each observer and ignores callbacks after three mount cycles', () => {
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
    for (let i = 0; i < 3; i += 1) {
      const host = document.createElement('div')
      const onStats = vi.fn()
      const handle = mountKalmanSmoothing(host, onStats)
      expect(host.querySelector('svg')).not.toBeNull()
      handle.setSettings({ ...DEFAULT_SETTINGS, cutoff: 50 })
      observers[i]!.draw()
      expect(onStats).toHaveBeenCalledTimes(3)
      handle.destroy()
      expect(observers[i]!.disconnect).toHaveBeenCalledOnce()
      handle.setSettings(DEFAULT_SETTINGS)
      observers[i]!.draw()
      expect(onStats).toHaveBeenCalledTimes(3)
      expect(host.innerHTML).toBe('')
    }
  })
})

describe('single forward playback', () => {
  it('starts at zero, reveals both estimates once, and stays stopped after completion', () => {
    const frames = new Map<number, FrameRequestCallback>()
    let id = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++id, callback)
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
    let intersection: IntersectionObserverCallback | null = null
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersection = callback
        }
        observe() {}
        disconnect() {}
      },
    )
    let hidden = false
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    const onPlayback = vi.fn()
    const host = document.createElement('div')
    const handle = mountKalmanSmoothing(host, vi.fn(), onPlayback, { autoplay: true })
    expect(onPlayback.mock.calls[0]?.[0]).toMatchObject({ phase: 'forward', settings: { cutoff: 100, inspect: 0 } })
    expect(host.querySelector('desc')?.textContent).toContain('revealed through 0.0 seconds')
    const advance = (time: number) => {
      const entry = [...frames.entries()][0]
      if (!entry) throw new Error('No scheduled frame')
      frames.delete(entry[0])
      entry[1](time)
    }
    advance(0)
    advance(350)
    expect(onPlayback.mock.lastCall?.[0].settings.inspect).toBe(3)
    expect(onPlayback.mock.lastCall?.[0].settings.cutoff).toBe(100)
    handle.pause()
    expect(frames.size).toBe(0)
    handle.resume()
    expect(onPlayback.mock.lastCall?.[0].settings.inspect).toBe(3)
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    expect(frames.size).toBe(0)
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    const notifyIntersection = intersection as unknown as (entries: Partial<IntersectionObserverEntry>[]) => void
    notifyIntersection([{ isIntersecting: false }])
    expect(frames.size).toBe(0)
    notifyIntersection([{ isIntersecting: true }])
    advance(2000)
    advance(12000)
    expect(onPlayback.mock.lastCall?.[0]).toMatchObject({
      phase: 'complete',
      running: false,
      settings: { inspect: 100 },
    })
    expect(frames.size).toBe(0)
    handle.resume()
    document.dispatchEvent(new Event('visibilitychange'))
    notifyIntersection([{ isIntersecting: true }])
    expect(frames.size).toBe(0)
    handle.play()
    expect(onPlayback.mock.lastCall?.[0]).toMatchObject({ phase: 'forward', settings: { inspect: 0 } })
    handle.setSettings({ ...DEFAULT_SETTINGS, cutoff: 60 })
    expect(frames.size).toBe(0)
    expect(onPlayback.mock.lastCall?.[0].phase).toBe('explore')
    handle.restart()
    const queued = [...frames.values()][0]!
    handle.destroy()
    queued(40000)
    handle.play()
    handle.pause()
    handle.resume()
    handle.restart()
    expect(frames.size).toBe(0)
    expect(host.innerHTML).toBe('')
  })
})
