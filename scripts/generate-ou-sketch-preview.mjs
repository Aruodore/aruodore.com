import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const size = 512
const fps = 30
const frames = fps * 6
const theta = 0.8
const sigma = 0.75
const dt = 1 / fps
const stationarySd = sigma / Math.sqrt(2 * theta)
const center = size / 2
const scale = size * 0.22
const band = stationarySd * scale
const state = { value: 0x9e3779b9 }
let spare = null

function random() {
  let x = state.value
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  state.value = x >>> 0
  return state.value / 0x100000000
}

function normal() {
  if (spare !== null) {
    const value = spare
    spare = null
    return value
  }
  const u = Math.max(Number.EPSILON, random())
  const v = random()
  const radius = Math.sqrt(-2 * Math.log(u))
  spare = radius * Math.sin(2 * Math.PI * v)
  return radius * Math.cos(2 * Math.PI * v)
}

const decay = Math.exp(-theta * dt)
const innovation = sigma * Math.sqrt((1 - Math.exp(-2 * theta * dt)) / (2 * theta))
const values = [0]
for (let i = 1; i < frames; i += 1) {
  values.push((values[i - 1] ?? 0) * decay + innovation * normal())
}

const frameDir = mkdtempSync(join(tmpdir(), 'aruodore-ou-'))
const outputDir = new URL('../public/sketches/', import.meta.url)
mkdirSync(outputDir, { recursive: true })

try {
  for (let frame = 0; frame < frames; frame += 1) {
    const visible = Math.min(frame + 1, values.length)
    const points = values
      .slice(0, visible)
      .map((value, index) => {
        const x = (index / Math.max(1, frames - 1)) * size
        const y = center - value * scale
        return `${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ')
    const fade = frame > frames - 16 ? (frames - frame) / 16 : 1
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="512" height="512" fill="#FAFAF7"/>
<rect y="${center - band}" width="512" height="${band * 2}" fill="#1E3A5F" fill-opacity="0.08"/>
<path d="M0 ${center}H512" stroke="#6B6B66" stroke-width="1"/>
<polyline points="${points}" fill="none" stroke="#C77B3C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="${fade}"/>
</svg>`
    writeFileSync(join(frameDir, `frame-${String(frame).padStart(4, '0')}.svg`), svg)
  }

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      join(frameDir, 'frame-%04d.svg'),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      new URL('../public/sketches/ornstein-uhlenbeck.mp4', import.meta.url).pathname,
    ],
    { stdio: 'inherit' },
  )
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      join(frameDir, 'frame-0120.svg'),
      '-frames:v',
      '1',
      '-update',
      '1',
      new URL('../public/sketches/ornstein-uhlenbeck.png', import.meta.url).pathname,
    ],
    { stdio: 'inherit' },
  )
} finally {
  rmSync(frameDir, { recursive: true, force: true })
}
