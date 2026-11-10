export type FrameMotion = (progress: number) => void
export type MotionFactory = (svg: SVGSVGElement) => FrameMotion
export interface PlaybackOptions {
  plot: HTMLElement
  onTick: () => boolean
  onRunning: (running: boolean) => void
  onSize: (mobile: boolean) => void
  onProgress?: (progress: number) => void
  duration?: number
}
/* Inference is computed at update boundaries. The rAF loop only presents the
 * transport/conditioning between those boundaries, using persistent SVG nodes. */
export function mountPlayback(host: HTMLElement, options: PlaybackOptions) {
  let single = false
  let running = false,
    visible = true,
    destroyed = false
  let frame: number | null = null,
    lastTime: number | null = null
  let elapsed = 0,
    dwell = 0,
    progress = 1
  let motion: FrameMotion | null = null
  const duration = options.duration ?? 1400
  const cancel = () => {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    lastTime = null
  }
  const updateSize = () => {
    if (!destroyed) options.onSize(host.getBoundingClientRect().width < 620)
  }
  const pause = () => {
    if (destroyed) return
    running = false
    cancel()
    options.onRunning(false)
    options.onProgress?.(progress)
  }
  const schedule = () => {
    if (running && visible && !document.hidden && !destroyed && frame === null) frame = requestAnimationFrame(tick)
  }
  function tick(time: number) {
    frame = null
    if (!running || !visible || document.hidden || destroyed) return
    const delta = lastTime === null ? 0 : Math.min(64, time - lastTime)
    lastTime = time
    if (motion && progress < 1) {
      elapsed += delta
      progress = Math.min(1, elapsed / duration)
      motion(progress)
      options.onProgress?.(progress)
      if (progress === 1) {
        motion = null
        dwell = 0
        if (single) {
          pause()
          return
        }
      }
    } else {
      if (single) {
        pause()
        return
      }
      dwell += delta
      if (dwell >= 180) {
        dwell = 0
        if (!options.onTick()) {
          pause()
          return
        }
      }
    }
    schedule()
  }
  const visibility = () => {
    cancel()
    schedule()
  }
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateSize)
  const intersection =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(
          ([entry]) => {
            if (destroyed) return
            visible = entry?.isIntersecting ?? true
            visibility()
          },
          { threshold: 0.05 },
        )
  updateSize()
  resize?.observe(host)
  intersection?.observe(host)
  if (!resize) window.addEventListener('resize', updateSize)
  document.addEventListener('visibilitychange', visibility)
  return {
    draw(markup: string, factory?: MotionFactory) {
      if (destroyed) return
      options.plot.innerHTML = markup
      const svg = options.plot.querySelector<SVGSVGElement>('svg')
      motion = factory && svg ? factory(svg) : null
      elapsed = 0
      dwell = 0
      progress = motion ? 0 : 1
      if (motion) {
        motion(0)
        options.onProgress?.(0)
      }
    },
    play(once = false) {
      if (destroyed) return
      single = once
      running = true
      options.onRunning(true)
      schedule()
    },
    pause,
    destroy() {
      destroyed = true
      running = false
      cancel()
      motion = null
      options.plot.replaceChildren()
      resize?.disconnect()
      intersection?.disconnect()
      window.removeEventListener('resize', updateSize)
      document.removeEventListener('visibilitychange', visibility)
    },
  }
}
