import * as THREE from 'three'

/*
 * Soft circular particle sprite, generated in code so no external
 * texture asset is needed. A 32×32 canvas is filled with a radial
 * gradient: fully opaque `posterior` navy at the centre, fading to
 * fully transparent at the edge with a Gaussian-like falloff.
 *
 * Alpha is composited against the light page background, so the
 * accumulation of many overlapping particles reads as ink density
 * rather than additive glow. Additive blending is wrong on a light
 * background — it brightens toward white instead of darkening.
 */

const SIZE = 32
const POSTERIOR = '30, 58, 95'  // sRGB components of #1E3A5F

export function createParticleSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('2D context unavailable for sprite generation')
  }

  const center = SIZE / 2
  const radius = SIZE / 2

  const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius)
  // Gaussian-ish falloff approximated with a few stops. The squared
  // offset positions push opacity toward the centre, which is what
  // a true Gaussian profile e^{-r^2 / 2 sigma^2} does.
  gradient.addColorStop(0.0, `rgba(${POSTERIOR}, 1.0)`)
  gradient.addColorStop(0.25, `rgba(${POSTERIOR}, 0.72)`)
  gradient.addColorStop(0.5, `rgba(${POSTERIOR}, 0.32)`)
  gradient.addColorStop(0.75, `rgba(${POSTERIOR}, 0.08)`)
  gradient.addColorStop(1.0, `rgba(${POSTERIOR}, 0.0)`)

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, SIZE, SIZE)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}
