/* global document, Ekf */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { chromium } from '@playwright/test'
import { build } from 'esbuild'

const directory = mkdtempSync(join(tmpdir(), 'extended-kalman-filtering-video-'))
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 900, height: 610 },
    reducedMotion: 'reduce',
    recordVideo: { dir: directory, size: { width: 900, height: 610 } },
  })
  const page = await context.newPage()
  await page.setContent('<body style="margin:0"><div id="figure" style="width:900px;height:610px"></div></body>')
  const bundle = await build({
    entryPoints: ['pieces/extended-kalman-filtering/simulation.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'Ekf',
  })
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await page.evaluate(() => {
    const host = document.getElementById('figure')
    Ekf.mountExtendedKalman(
      host,
      { angle: 1.5, uncertainty: 0.35, noise: 0.08, inspect: 80, seed: 42 },
      () => {},
    ).resume()
  })
  await page.waitForTimeout(13700)
  const video = page.video()
  await context.close()
  if (!video) throw new Error('No recorded video')
  const source = await video.path()
  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'warning',
      '-i',
      source,
      '-an',
      '-c:v',
      'libvpx-vp9',
      '-deadline',
      'realtime',
      '-cpu-used',
      '8',
      '-r',
      '10',
      '-crf',
      '38',
      '-b:v',
      '0',
      '-pix_fmt',
      'yuv420p',
      'public/pieces/extended-kalman-filtering/preview.webm',
    ],
    { stdio: 'inherit' },
  )
  if (result.status !== 0) throw new Error('Video encoding failed')
} finally {
  await browser.close()
}
