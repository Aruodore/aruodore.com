/*
 * Three-dimensional Ornstein–Uhlenbeck process: N independent paths.
 *
 * Each coordinate follows
 *
 *     dX_t = -theta (X_t - mu) dt + sigma dW_t.
 *
 * The drift pulls X_t toward mu while Brownian noise continually moves it
 * away. Unlike free Brownian motion, the variance does not grow forever:
 *
 *     Var(X_t | X_0 = x_0)
 *       = sigma^2 / (2 theta) * (1 - exp(-2 theta t)).
 *
 * Its stationary distribution is N(mu, sigma^2 / (2 theta)). The wireframe
 * sphere in the scene has radius sqrt(3) times the stationary per-coordinate
 * standard deviation, the stationary root-mean-square distance from mu.
 *
 * We use the exact finite-time transition rather than Euler–Maruyama:
 *
 *     X_{t+dt} = mu + exp(-theta dt) (X_t - mu)
 *                + sigma sqrt((1 - exp(-2 theta dt)) / (2 theta)) Z,
 *
 * with Z standard normal. The update therefore has the correct distribution
 * for every dt and remains stable if rendering cadence changes.
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createNormalSampler } from '../brownian-motion/box-muller'
import { createParticleSpriteTexture } from '../brownian-motion/sprite'
import {
  clampOrnsteinUhlenbeckParameters,
  ornsteinUhlenbeckStationaryVariance,
  ornsteinUhlenbeckTransition,
  type OrnsteinUhlenbeckParameters,
} from './model'

const N_PARTICLES = 75_000
const DT = 0.016
const DEFAULT_THETA = 0.5
const DEFAULT_MU = 0
const DEFAULT_SIGMA = 1
const BG_HEX = 0xfafaf7
const RULE_HEX = 0xd8d8d2
const OBSERVED_HEX = 0xc77b3c
const CAMERA_FOV = 50
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 100
const CAMERA_POS = { x: 4, y: 3, z: 8 } as const
const POINT_SIZE = 0.065
const MAX_PIXEL_RATIO = 2
const STATS_INTERVAL = 6

export interface OrnsteinUhlenbeckStats {
  elapsed: number
  empiricalVariance: number
  stationaryVariance: number
}

export interface OrnsteinUhlenbeckOptions {
  N?: number
  dt?: number
  parameters?: Partial<OrnsteinUhlenbeckParameters>
  onStatsUpdate?: (stats: OrnsteinUhlenbeckStats) => void
}

export interface OrnsteinUhlenbeckHandle {
  destroy: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  setParameters: (parameters: Partial<OrnsteinUhlenbeckParameters>) => void
}

export function mountOrnsteinUhlenbeck(
  container: HTMLElement,
  opts: OrnsteinUhlenbeckOptions = {},
): OrnsteinUhlenbeckHandle {
  const N = opts.N ?? N_PARTICLES
  const dt = opts.dt ?? DT
  const onStatsUpdate = opts.onStatsUpdate
  const parameters: OrnsteinUhlenbeckParameters = {
    theta: opts.parameters?.theta ?? DEFAULT_THETA,
    mu: opts.parameters?.mu ?? DEFAULT_MU,
    sigma: opts.parameters?.sigma ?? DEFAULT_SIGMA,
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
  renderer.setClearColor(BG_HEX, 1)
  container.appendChild(renderer.domElement)
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR)
  camera.position.set(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z)

  const positions = new Float32Array(N * 3)
  const geometry = new THREE.BufferGeometry()
  const attribute = new THREE.BufferAttribute(positions, 3)
  attribute.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', attribute)

  const spriteTexture = createParticleSpriteTexture()
  const material = new THREE.PointsMaterial({
    map: spriteTexture,
    size: POINT_SIZE,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
  })
  const points = new THREE.Points(geometry, material)
  scene.add(points)

  const shellGeometry = new THREE.SphereGeometry(1, 24, 16)
  const shellMaterial = new THREE.MeshBasicMaterial({
    color: RULE_HEX,
    wireframe: true,
    transparent: true,
    opacity: 0.52,
  })
  const shell = new THREE.Mesh(shellGeometry, shellMaterial)
  scene.add(shell)

  const equilibriumGeometry = new THREE.SphereGeometry(0.055, 12, 8)
  const equilibriumMaterial = new THREE.MeshBasicMaterial({ color: OBSERVED_HEX })
  const equilibrium = new THREE.Mesh(equilibriumGeometry, equilibriumMaterial)
  scene.add(equilibrium)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = 2
  controls.maxDistance = 30

  const nextNormal = createNormalSampler()
  let elapsed = 0
  let frameCount = 0
  let empiricalVariance = 0
  let rafId = 0
  let running = true

  function stationaryVariance() {
    return ornsteinUhlenbeckStationaryVariance(parameters.theta, parameters.sigma)
  }

  function updateReferenceGeometry() {
    const mu = parameters.mu
    const rmsRadius = Math.sqrt(3 * stationaryVariance())
    shell.position.set(mu, mu, mu)
    shell.scale.setScalar(rmsRadius)
    equilibrium.position.set(mu, mu, mu)
    controls.target.set(mu, mu, mu)
    camera.lookAt(mu, mu, mu)
  }

  function emitStats() {
    onStatsUpdate?.({
      elapsed,
      empiricalVariance,
      stationaryVariance: stationaryVariance(),
    })
  }

  function advance() {
    const mu = parameters.mu
    const measure = frameCount % STATS_INTERVAL === 0
    let squaredDeviation = 0

    for (let i = 0; i < positions.length; i++) {
      const next = ornsteinUhlenbeckTransition(positions[i] ?? 0, parameters, dt, nextNormal())
      positions[i] = next
      if (measure) squaredDeviation += (next - mu) * (next - mu)
    }

    if (measure) empiricalVariance = squaredDeviation / positions.length
    attribute.needsUpdate = true
    elapsed += dt
    frameCount += 1
  }

  function frame() {
    if (!running) return
    advance()
    controls.update()
    renderer.render(scene, camera)
    if (frameCount % STATS_INTERVAL === 1) emitStats()
    rafId = requestAnimationFrame(frame)
  }

  function applySize() {
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const resizeObserver = new ResizeObserver(applySize)
  resizeObserver.observe(container)
  applySize()
  updateReferenceGeometry()
  emitStats()
  rafId = requestAnimationFrame(frame)

  return {
    destroy() {
      running = false
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      controls.dispose()
      geometry.dispose()
      material.dispose()
      spriteTexture.dispose()
      shellGeometry.dispose()
      shellMaterial.dispose()
      equilibriumGeometry.dispose()
      equilibriumMaterial.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    },
    pause() {
      if (!running) return
      running = false
      cancelAnimationFrame(rafId)
    },
    resume() {
      if (running) return
      running = true
      rafId = requestAnimationFrame(frame)
    },
    reset() {
      positions.fill(0)
      attribute.needsUpdate = true
      elapsed = 0
      frameCount = 0
      empiricalVariance = 0
      emitStats()
    },
    setParameters(next) {
      Object.assign(parameters, clampOrnsteinUhlenbeckParameters(parameters, next))
      updateReferenceGeometry()
      emitStats()
    },
  }
}
