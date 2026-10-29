import {
  createRecord,
  DEFAULT_SETTINGS,
  DT,
  smoothingStats,
  type SmoothingSettings,
  type SmoothingStats,
} from './model'
import { renderSmoothing } from './figure'

export type PlaybackPhase = 'explore' | 'forward' | 'complete'
export interface PlaybackState {
  phase: PlaybackPhase
  running: boolean
  settings: SmoothingSettings
}
export interface SmoothingHandle {
  setSettings: (settings: SmoothingSettings) => void
  play: () => void
  resume: () => void
  pause: () => void
  restart: () => void
  destroy: () => void
}
const FORWARD_MS = DT * 1000

/* The recorded filter and smoother trajectories are revealed together,
 * once, from left to right. Smoothing still uses the full selected record;
 * the playback cursor only controls the drawing, never the evidence. */
export function mountKalmanSmoothing(
  host: HTMLElement,
  onStats: (stats: SmoothingStats) => void,
  onPlayback: (state: PlaybackState) => void = () => {},
  options: { autoplay?: boolean; settings?: SmoothingSettings } = {},
): SmoothingHandle {
  let settings: SmoothingSettings = { ...(options.settings ?? DEFAULT_SETTINGS) }
  let record = createRecord(settings)
  let phase: PlaybackPhase = 'explore'
  let cursor = 0
  let running = false
  let destroyed = false
  let visible = true
  let frame: number | null = null
  let lastTick: number | null = null

  const draw = () => {
    if (destroyed) return
    host.innerHTML = renderSmoothing(
      record,
      host.getBoundingClientRect().width < 620,
      phase === 'forward' ? cursor : record.settings.cutoff,
    )
    onStats(smoothingStats(record))
    onPlayback({ phase, running, settings: { ...record.settings } })
  }
  const cancel = () => {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    lastTick = null
  }
  const schedule = () => {
    if (!destroyed && running && visible && !document.hidden && frame === null) frame = requestAnimationFrame(tick)
  }
  const begin = () => {
    phase = 'forward'
    cursor = 0
    record = createRecord({ ...settings, inspect: 0 })
    lastTick = null
  }
  const tick = (time: number) => {
    frame = null
    if (destroyed || !running || !visible || document.hidden) return
    if (lastTick === null) lastTick = time
    const interval = FORWARD_MS
    if (time - lastTick >= interval) {
      const steps = Math.floor((time - lastTick) / interval)
      lastTick += steps * interval
      if (phase === 'forward') {
        cursor = Math.min(record.settings.cutoff, cursor + steps)
        record.settings.inspect = cursor
        if (cursor >= record.settings.cutoff) {
          phase = 'complete'
          running = false
        }
      }
      draw()
    }
    schedule()
  }
  const syncVisibility = () => {
    cancel()
    schedule()
  }
  const observer = new ResizeObserver(draw)
  const intersection = new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? true
      syncVisibility()
    },
    { threshold: 0.05 },
  )
  if (options.autoplay) {
    begin()
    running = true
  }
  observer.observe(host)
  intersection.observe(host)
  document.addEventListener('visibilitychange', syncVisibility)
  draw()
  schedule()
  return {
    setSettings(next) {
      if (destroyed) return
      running = false
      cancel()
      record = createRecord(next)
      settings = { ...record.settings }
      phase = 'explore'
      draw()
    },
    play() {
      if (destroyed) return
      if (phase === 'explore' || phase === 'complete') begin()
      running = true
      draw()
      schedule()
    },
    resume() {
      if (destroyed || phase === 'complete' || phase === 'explore' || running) return
      running = true
      draw()
      schedule()
    },
    pause() {
      if (destroyed) return
      running = false
      cancel()
      draw()
    },
    restart() {
      if (destroyed) return
      cancel()
      begin()
      running = true
      draw()
      schedule()
    },
    destroy() {
      destroyed = true
      running = false
      cancel()
      observer.disconnect()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', syncVisibility)
      host.replaceChildren()
    },
  }
}
