/*
 * Generates public/pieces/brownian-motion/preview.png by simulating the
 * same SDE as the live piece (sigma = 1, dt = 1/62.5, N = 100k walkers)
 * for t ≈ 4 s, projecting through a camera matching simulation.ts
 * (position (4, 3, 8), looking at origin, fov 50°), and rasterising
 * each particle as a posterior-navy alpha sprite onto the `bg` token.
 *
 * Output is a PPM piped through ImageMagick `convert` to PNG. Run with
 *   node scripts/generate-brownian-preview.mjs
 * from the repo root. Re-run with a different SEED to get a fresh
 * realisation of the cloud.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'

// --- simulation parameters: must match pieces/brownian-motion/simulation.ts
const N = 100_000
const SIGMA = 1
const DT = 0.016
const STEPS = 250 // t = 4 s

// --- image dimensions and camera: must match the runtime camera so the
// composition reads the same as the live piece.
const W = 1600
const H = 1000
const CAM = [4, 3, 8]
const TARGET = [0, 0, 0]
const FOV_Y = (50 * Math.PI) / 180
const TAN_HALF = Math.tan(FOV_Y / 2)
const ASPECT = W / H
const NEAR = 0.1

// --- palette tokens (CLAUDE.md §4.1)
const BG = [0xfa, 0xfa, 0xf7]
const FG = [0x1e, 0x3a, 0x5f] // posterior

// --- sprite kernel: matches the radial-gradient stops in
// pieces/brownian-motion/sprite.ts, scaled down so 100k stamps build up
// density gradually instead of saturating the centre instantly.
const K = 9
const HALF = (K - 1) / 2
const KERN_SCALE = 0.18

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l] }

const FORWARD = norm(sub(TARGET, CAM))
const RIGHT = norm(cross(FORWARD, [0, 1, 0]))
const UP = cross(RIGHT, FORWARD)

// Box–Muller with cached second sample, mirroring box-muller.ts.
let cached = null
function nextNormal() {
  if (cached !== null) { const z = cached; cached = null; return z }
  const u1 = Math.random() + Number.EPSILON
  const u2 = Math.random()
  const r = Math.sqrt(-2 * Math.log(u1))
  const t = 2 * Math.PI * u2
  cached = r * Math.sin(t)
  return r * Math.cos(t)
}

// Build the sprite kernel from the same stops as sprite.ts.
function buildKernel() {
  const k = new Float32Array(K * K)
  for (let y = 0; y < K; y++) {
    for (let x = 0; x < K; x++) {
      const r = Math.hypot(x - HALF, y - HALF) / HALF
      let a
      if (r >= 1) a = 0
      else if (r >= 0.75) a = (0.08 * (1 - r)) / 0.25
      else if (r >= 0.5) a = 0.08 + ((0.32 - 0.08) * (0.75 - r)) / 0.25
      else if (r >= 0.25) a = 0.32 + ((0.72 - 0.32) * (0.5 - r)) / 0.25
      else a = 0.72 + ((1.0 - 0.72) * (0.25 - r)) / 0.25
      k[y * K + x] = a * KERN_SCALE
    }
  }
  return k
}

function simulate() {
  const positions = new Float32Array(N * 3)
  const step = SIGMA * Math.sqrt(DT)
  for (let s = 0; s < STEPS; s++) {
    for (let i = 0; i < positions.length; i++) {
      positions[i] += step * nextNormal()
    }
  }
  return positions
}

function rasterise(positions, kernel) {
  const alpha = new Float32Array(W * H)
  let visible = 0
  for (let i = 0; i < N; i++) {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    const vx = x - CAM[0]
    const vy = y - CAM[1]
    const vz = z - CAM[2]
    const zCam = vx * FORWARD[0] + vy * FORWARD[1] + vz * FORWARD[2]
    if (zCam <= NEAR) continue
    const xCam = vx * RIGHT[0] + vy * RIGHT[1] + vz * RIGHT[2]
    const yCam = vx * UP[0] + vy * UP[1] + vz * UP[2]
    const xN = xCam / (zCam * TAN_HALF * ASPECT)
    const yN = yCam / (zCam * TAN_HALF)
    if (xN < -1.1 || xN > 1.1 || yN < -1.1 || yN > 1.1) continue
    const px = Math.round((xN + 1) * 0.5 * W)
    const py = Math.round((1 - yN) * 0.5 * H)
    visible++
    for (let ky = 0; ky < K; ky++) {
      const yy = py - HALF + ky
      if (yy < 0 || yy >= H) continue
      for (let kx = 0; kx < K; kx++) {
        const xx = px - HALF + kx
        if (xx < 0 || xx >= W) continue
        const idx = yy * W + xx
        const k = kernel[ky * K + kx]
        alpha[idx] = alpha[idx] + (1 - alpha[idx]) * k
      }
    }
  }
  return { alpha, visible }
}

function composite(alpha) {
  const rgb = Buffer.alloc(W * H * 3)
  for (let i = 0; i < W * H; i++) {
    const a = alpha[i]
    const inv = 1 - a
    rgb[i * 3] = Math.round(BG[0] * inv + FG[0] * a)
    rgb[i * 3 + 1] = Math.round(BG[1] * inv + FG[1] * a)
    rgb[i * 3 + 2] = Math.round(BG[2] * inv + FG[2] * a)
  }
  return rgb
}

function main() {
  console.error(`simulating ${N} walkers, ${STEPS} steps (t = ${(STEPS * DT).toFixed(2)} s)…`)
  const positions = simulate()
  console.error('rasterising…')
  const kernel = buildKernel()
  const { alpha, visible } = rasterise(positions, kernel)
  console.error(`projected ${visible}/${N} particles inside the viewport.`)
  const rgb = composite(alpha)

  const ppmPath = '/tmp/brownian-preview.ppm'
  const outPath = 'public/pieces/brownian-motion/preview.png'
  const header = Buffer.from(`P6\n${W} ${H}\n255\n`, 'ascii')
  writeFileSync(ppmPath, Buffer.concat([header, rgb]))
  mkdirSync(dirname(outPath), { recursive: true })
  console.error('encoding png…')
  const res = spawnSync('convert', [ppmPath, '-strip', outPath], { stdio: 'inherit' })
  if (res.status !== 0) {
    console.error('ImageMagick `convert` failed.')
    process.exit(res.status ?? 1)
  }
  console.error(`wrote ${outPath}`)
}

main()
