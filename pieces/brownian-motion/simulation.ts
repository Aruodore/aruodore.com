/*
 * Three-dimensional Brownian motion — N independent walkers in R^3.
 *
 * Each particle X_t in R^3 evolves under the stochastic differential
 * equation
 *
 *     dX_t = sigma dW_t,
 *
 * where W_t is a standard 3D Wiener process — three independent 1D
 * Brownian motions, one per coordinate. The transition density from
 * the origin at time t is the isotropic 3D Gaussian
 *
 *     p(x, t) = (2 pi sigma^2 t)^{-3/2} exp(-||x||^2 / (2 sigma^2 t)),
 *
 * which has variance sigma^2 t per coordinate. The cloud's
 * one-sigma radius therefore grows as sigma * sqrt(t), not sigma * t —
 * the signature of diffusion as opposed to ballistic transport.
 *
 * The density p(x, t) also satisfies the heat equation
 *
 *     dp/dt = (sigma^2 / 2) Laplacian(p),
 *
 * so what you watch on screen is the stochastic counterpart of heat
 * diffusing through a uniform medium.
 *
 * Discretisation. With step dt and i.i.d. standard normals
 * Z = (Z^1, Z^2, Z^3), the Euler–Maruyama update is
 *
 *     X_{t+dt} = X_t + sigma * sqrt(dt) * Z.
 *
 * The scale factor sigma * sqrt(dt) — not sigma * dt — is what
 * preserves the variance sigma^2 t of true Brownian motion under
 * discretisation. The sqrt comes from the quadratic variation of W_t,
 * the same property that makes Brownian paths nowhere differentiable.
 *
 * Performance. The state is a Float32Array of length 3N updated on
 * the CPU each frame and uploaded to a THREE.BufferAttribute marked
 * with DynamicDrawUsage. At N = 100k this holds 60 fps comfortably on
 * a recent laptop; a future piece will revisit the same problem with
 * a GPU compute backend at far higher particle counts.
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createNormalSampler } from './box-muller'
import { brownianStepScale } from './model'
import { createParticleSpriteTexture } from './sprite'

// Tuned for 60 fps with headroom on a recent laptop. Holds stable at
// 100k on modern Chrome / Firefox with integrated graphics; if a
// future host falls below 60 fps the floor is 50k per the spec.
const N_PARTICLES = 100_000

// Diffusion coefficient and timestep. With sigma = 1 and dt = 1/62.5,
// the cloud's per-axis standard deviation at simulation time t = 5 s
// is sqrt(5) ≈ 2.24 units — comfortably inside the default camera
// distance of ~9.43 units so the cloud reads as expansion rather than
// overflow during the first few seconds after a reset.
const SIGMA = 1
const DT = 0.016

// Site palette tokens (claude.md). Clear color is `bg`; the
// sprite carries the `posterior` accent via the shared helper.
const BG_HEX = 0xfafaf7

// Camera default. Distance sqrt(4^2 + 3^2 + 8^2) ≈ 9.43; the cloud's
// 1-sigma radius reaches that distance only past t ≈ 89 s (sqrt(89)),
// so the user can orbit a growing cloud for a long time before it
// fully escapes the viewport.
const CAMERA_FOV = 50
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 200
const CAMERA_POS = { x: 4, y: 3, z: 8 } as const

// Point size in world units. With sizeAttenuation: true the screen
// size at distance d is approximately
//     size * (canvas_h / 2) / (d * tan(fov/2)).
// For d ≈ 9.43, fov 50°, canvas height 600 px this gives ~5 px at
// world size ≈ 0.07. Owner may retune visually.
const POINT_SIZE = 0.07

// Orbit zoom envelope. Avoids the user falling inside the cloud or
// zooming so far out that the points collapse to a single pixel.
const MIN_DISTANCE = 2
const MAX_DISTANCE = 60

// Pixel ratio cap — devicePixelRatio above 2 burns fillrate for
// imperceptible gains at this point density.
const MAX_PIXEL_RATIO = 2

// One representative walker is retained as a short orange trajectory. The
// cloud shows the ensemble distribution; the line shows what one path through
// that distribution actually looks like. At 60 fps this stores about 30 s.
const MAX_TRAIL_POINTS = 1_800

const RULE_HEX = 0xd8d8d2
const OBSERVED_HEX = 0xc77b3c

export interface BrownianMotionOptions {
  /** Number of independent walkers. Default 100_000. */
  N?: number
  /** Diffusion coefficient sigma. Default 1. */
  sigma?: number
  /** Simulation timestep in seconds. Default 0.016. */
  dt?: number
  /** Called once per rendered frame with simulation time t (s). */
  onTimeUpdate?: (t: number) => void
}

export interface BrownianMotionHandle {
  destroy: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  getTime: () => number
}

export function mountBrownianMotion(container: HTMLElement, opts: BrownianMotionOptions = {}): BrownianMotionHandle {
  const N = opts.N ?? N_PARTICLES
  const sigma = opts.sigma ?? SIGMA
  const dt = opts.dt ?? DT
  const onTimeUpdate = opts.onTimeUpdate

  // Renderer ------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
  renderer.setClearColor(BG_HEX, 1)
  container.appendChild(renderer.domElement)
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'

  // Scene + camera ------------------------------------------------------
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR)
  camera.position.set(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z)
  camera.lookAt(0, 0, 0)

  // Particle buffer -----------------------------------------------------
  // positions[3i .. 3i+2] = (x, y, z) of particle i. All start at the
  // origin, then take independent Gaussian steps each frame.
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

  // The faint sphere marks the ensemble's theoretical RMS distance from the
  // origin, sqrt(E[||X_t||^2]) = sigma sqrt(3t). It expands with sqrt(t), so
  // the reference geometry makes the defining scaling law visible.
  const shellGeometry = new THREE.SphereGeometry(1, 24, 16)
  const shellMaterial = new THREE.MeshBasicMaterial({
    color: RULE_HEX,
    wireframe: true,
    transparent: true,
    opacity: 0.52,
  })
  const shell = new THREE.Mesh(shellGeometry, shellMaterial)
  shell.visible = false
  scene.add(shell)

  // The first particle becomes an observed path through the inferred density.
  // The line uses a fixed buffer to avoid allocating during the frame loop.
  const trailPositions = new Float32Array(MAX_TRAIL_POINTS * 3)
  const trailGeometry = new THREE.BufferGeometry()
  const trailAttribute = new THREE.BufferAttribute(trailPositions, 3)
  trailAttribute.setUsage(THREE.DynamicDrawUsage)
  trailGeometry.setAttribute('position', trailAttribute)
  trailGeometry.setDrawRange(0, 1)
  const trailMaterial = new THREE.LineBasicMaterial({
    color: OBSERVED_HEX,
    transparent: true,
    opacity: 0.88,
  })
  const trail = new THREE.Line(trailGeometry, trailMaterial)
  trail.renderOrder = 2
  scene.add(trail)

  const observedPosition = new Float32Array(3)
  const observedGeometry = new THREE.BufferGeometry()
  const observedAttribute = new THREE.BufferAttribute(observedPosition, 3)
  observedAttribute.setUsage(THREE.DynamicDrawUsage)
  observedGeometry.setAttribute('position', observedAttribute)
  const observedMaterial = new THREE.PointsMaterial({
    color: OBSERVED_HEX,
    size: POINT_SIZE * 2.6,
    sizeAttenuation: true,
    depthWrite: false,
  })
  const observedPoint = new THREE.Points(observedGeometry, observedMaterial)
  observedPoint.renderOrder = 3
  scene.add(observedPoint)

  // Controls ------------------------------------------------------------
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.enableRotate = true
  controls.enableZoom = true
  controls.minDistance = MIN_DISTANCE
  controls.maxDistance = MAX_DISTANCE

  // Random source ------------------------------------------------------
  // One sampler instance — the internal cache reuses the second
  // Box–Muller sample of every pair so no random is wasted across
  // particles, even though each particle needs 3 normals and one
  // Box–Muller call yields 2.
  const nextNormal = createNormalSampler()

  // Precomputed Euler–Maruyama scale. See module preamble: the factor
  // is sigma * sqrt(dt), giving the correct N(0, sigma^2 dt) increment
  // per coordinate when multiplied by a standard normal.
  const step = brownianStepScale(sigma, dt)

  let elapsed = 0
  let trailCount = 1
  let rafId = 0
  let running = false

  function advance() {
    // For each particle, add an independent N(0, sigma^2 dt) increment
    // to each of (x, y, z). Z^1, Z^2, Z^3 are mutually independent.
    for (let i = 0; i < positions.length; i++) {
      positions[i] = (positions[i] ?? 0) + step * nextNormal()
    }
    attribute.needsUpdate = true
    elapsed += dt

    const observedX = positions[0] ?? 0
    const observedY = positions[1] ?? 0
    const observedZ = positions[2] ?? 0
    observedPosition[0] = observedX
    observedPosition[1] = observedY
    observedPosition[2] = observedZ
    observedAttribute.needsUpdate = true

    const trailIndex = trailCount < MAX_TRAIL_POINTS ? trailCount : MAX_TRAIL_POINTS - 1
    if (trailCount >= MAX_TRAIL_POINTS) {
      trailPositions.copyWithin(0, 3)
    }
    const offset = trailIndex * 3
    trailPositions[offset] = observedX
    trailPositions[offset + 1] = observedY
    trailPositions[offset + 2] = observedZ
    trailCount = Math.min(MAX_TRAIL_POINTS, trailCount + 1)
    trailGeometry.setDrawRange(0, trailCount)
    trailAttribute.needsUpdate = true

    const rmsRadius = sigma * Math.sqrt(3 * elapsed)
    shell.scale.setScalar(rmsRadius)
    shell.visible = rmsRadius > 0.05
  }

  function render() {
    controls.update()
    renderer.render(scene, camera)
  }

  function frame() {
    if (!running) return
    advance()
    render()
    onTimeUpdate?.(elapsed)
    rafId = requestAnimationFrame(frame)
  }

  // Resize observer ----------------------------------------------------
  function applySize() {
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  const resizeObserver = new ResizeObserver(() => {
    applySize()
  })
  resizeObserver.observe(container)
  applySize()

  // Boot ---------------------------------------------------------------
  running = true
  rafId = requestAnimationFrame(frame)
  onTimeUpdate?.(elapsed)

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
      trailGeometry.dispose()
      trailMaterial.dispose()
      observedGeometry.dispose()
      observedMaterial.dispose()
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
      trailPositions.fill(0)
      trailCount = 1
      trailGeometry.setDrawRange(0, trailCount)
      trailAttribute.needsUpdate = true
      observedPosition.fill(0)
      observedAttribute.needsUpdate = true
      shell.visible = false
      elapsed = 0
      onTimeUpdate?.(elapsed)
    },
    getTime() {
      return elapsed
    },
  }
}
