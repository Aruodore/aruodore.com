import { createRecord, DT, STEPS, type Settings, type Step } from './model'
import { renderFigure } from './figure'

const END_HOLD_SECONDS = 1.5
const MAX_ELAPSED_SECONDS = 0.1

export function mountExtendedKalman(
  host: HTMLElement,
  initial: Settings,
  report: (record: Step[]) => void,
  onPlayback: (inspect: number, running: boolean) => void = () => {},
) {
  let settings = { ...initial }
  let record = createRecord(settings)
  let destroyed = false
  let running = false
  let visible = true
  let raf = 0
  let previous: number | null = null
  let elapsed = 0
  const draw = () => {
    if (!destroyed) host.innerHTML = renderFigure(record, settings, host.clientWidth < 620, true)
  }
  const notify = () => {
    report(record)
    onPlayback(settings.inspect, running)
  }
  const stopFrame = () => {
    cancelAnimationFrame(raf)
    raf = 0
    previous = null
  }
  const schedule = () => {
    if (!destroyed && running && visible && !document.hidden && !raf) raf = requestAnimationFrame(frame)
  }
  function frame(timestamp: number) {
    raf = 0
    if (destroyed || !running || !visible || document.hidden) return
    if (previous !== null) elapsed += Math.min(MAX_ELAPSED_SECONDS, (timestamp - previous) / 1000)
    previous = timestamp
    let changed = false
    // Each revealed state has used exactly its prefix of measurements.
    if (settings.inspect === STEPS) {
      if (elapsed >= END_HOLD_SECONDS) {
        settings.inspect = 1
        elapsed = 0
        changed = true
      }
    } else {
      while (elapsed >= DT && settings.inspect < STEPS) {
        elapsed -= DT
        settings.inspect++
        changed = true
      }
      if (settings.inspect === STEPS) elapsed = 0
    }
    if (changed) {
      draw()
      notify()
    }
    schedule()
  }
  function pause() {
    if (destroyed) return
    running = false
    stopFrame()
    onPlayback(settings.inspect, running)
  }
  function resume() {
    if (destroyed) return
    running = true
    onPlayback(settings.inspect, running)
    schedule()
  }
  const resizeObserver = new ResizeObserver(draw)
  const intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? true
      stopFrame()
      schedule()
    },
    { threshold: 0.05 },
  )
  const visibility = () => {
    stopFrame()
    schedule()
  }
  resizeObserver.observe(host)
  intersectionObserver.observe(host)
  document.addEventListener('visibilitychange', visibility)
  draw()
  notify()
  return {
    pause,
    resume,
    restart() {
      if (destroyed) return
      settings.inspect = 1
      elapsed = 0
      previous = null
      draw()
      notify()
    },
    setSettings(next: Settings) {
      if (destroyed) return
      const regenerate =
        next.angle !== settings.angle ||
        next.uncertainty !== settings.uncertainty ||
        next.noise !== settings.noise ||
        next.seed !== settings.seed
      const scrubbed = next.inspect !== settings.inspect
      settings = { ...next }
      if (regenerate) record = createRecord(settings)
      if (scrubbed) pause()
      elapsed = 0
      draw()
      notify()
    },
    destroy() {
      destroyed = true
      running = false
      stopFrame()
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      host.replaceChildren()
    },
  }
}
