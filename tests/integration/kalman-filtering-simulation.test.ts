import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OPENING_STEP, DT, type TrackerStats } from '../../pieces/kalman-filtering/model'
import { mountKalmanFiltering } from '../../pieces/kalman-filtering/simulation'

const observers = vi.hoisted(() => ({ disconnect: vi.fn(), observe: vi.fn() }))

function fakeCanvas(withContext = true) {
  const calls: string[] = []
  const context = new Proxy({ measureText: () => ({ width: 40 }) } as Record<string, unknown>, {
    get: (target, key: string) => target[key] ?? ((..._args: unknown[]) => void calls.push(key)),
    set: () => true,
  })
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (withContext ? context : null),
    getBoundingClientRect: () => ({ width: 800, height: 500 }),
  } as unknown as HTMLCanvasElement
  return { canvas, calls }
}

describe('kalman filtering simulation', () => {
  let frames: FrameRequestCallback[]

  beforeEach(() => {
    frames = []
    observers.disconnect.mockReset()
    observers.observe.mockReset()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observers.observe
        disconnect = observers.disconnect
      },
    )
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => vi.unstubAllGlobals())

  it('throws when canvas 2D is unavailable', () => {
    expect(() => mountKalmanFiltering(fakeCanvas(false).canvas)).toThrow('Canvas 2D is unavailable')
  })

  it('opens on the preview frame and draws it', () => {
    const { canvas, calls } = fakeCanvas()
    const stats: TrackerStats[] = []
    mountKalmanFiltering(canvas, { onStatsUpdate: (next) => stats.push(next) })
    expect(stats.at(-1)?.step).toBe(OPENING_STEP)
    expect(calls).toContain('ellipse')
    expect(canvas.width).toBeGreaterThan(0)
  })

  it('advances one step per DT of elapsed time while running', () => {
    const { canvas } = fakeCanvas()
    const stats: TrackerStats[] = []
    const handle = mountKalmanFiltering(canvas, { onStatsUpdate: (next) => stats.push(next) })
    const start = performance.now()
    handle.resume()
    handle.resume()
    expect(frames).toHaveLength(1)
    frames.shift()!(start + DT * 1000 * 2 + 5)
    expect(stats.at(-1)?.step).toBe(OPENING_STEP + 2)
    expect(frames).toHaveLength(1)

    handle.pause()
    frames.shift()!(start + 10_000)
    expect(stats.at(-1)?.step).toBe(OPENING_STEP + 2)
    expect(frames).toHaveLength(0)
  })

  it('caps the catch-up after a stall', () => {
    const { canvas } = fakeCanvas()
    const stats: TrackerStats[] = []
    const handle = mountKalmanFiltering(canvas, { onStatsUpdate: (next) => stats.push(next) })
    handle.resume()
    frames.shift()!(performance.now() + 60_000)
    expect(stats.at(-1)!.step - OPENING_STEP).toBeLessThanOrEqual(2)
  })

  it('restarts from step zero and keeps the chosen parameters', () => {
    const { canvas } = fakeCanvas()
    const stats: TrackerStats[] = []
    const handle = mountKalmanFiltering(canvas, { onStatsUpdate: (next) => stats.push(next) })
    handle.setParameters({ processNoise: 99 })
    handle.restart()
    expect(stats.at(-1)).toMatchObject({ step: 0, filterRmse: expect.any(Number) })
    handle.resume()
    frames.shift()!(performance.now() + DT * 1000 + 1)
    expect(stats.at(-1)?.step).toBe(1)
  })

  it('redraws when the occluder is toggled', () => {
    const { canvas, calls } = fakeCanvas()
    const handle = mountKalmanFiltering(canvas)
    calls.length = 0
    handle.setOccluder(false)
    expect(calls).toContain('clearRect')
  })

  it('stops the loop and disconnects the resize observer on destroy', () => {
    const { canvas } = fakeCanvas()
    const handle = mountKalmanFiltering(canvas)
    handle.resume()
    handle.destroy()
    expect(cancelAnimationFrame).toHaveBeenCalled()
    expect(observers.disconnect).toHaveBeenCalledOnce()
    frames.shift()!(performance.now() + 5000)
    expect(frames).toHaveLength(0)
  })
})
