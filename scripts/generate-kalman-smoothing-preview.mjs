import { mkdirSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'

// Resolve the framework's extensionless TypeScript imports in Node as well.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/pieces/') && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
})
const { createRecord } = await import('../pieces/kalman-smoothing/model.ts')
const { renderSmoothing } = await import('../pieces/kalman-smoothing/figure.ts')

const directory = 'public/pieces/kalman-smoothing'
mkdirSync(directory, { recursive: true })
const record = createRecord()
writeFileSync(`${directory}/preview.svg`, renderSmoothing(record))
writeFileSync(`${directory}/preview-mobile.svg`, renderSmoothing(record, true))

const { chromium } = await import('@playwright/test')
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.setContent(
    `<html><body style="margin:0;background:#FAFAF7;color:#1A1A1A"><main style="padding:34px 48px;font-family:Georgia,serif"><div style="font:16px system-ui;color:#6B6B66">ARUODORE · PROBABILITY AND INFERENCE</div><h1 style="font-size:44px;font-weight:400;margin:16px 0 4px">Kalman Smoothing</h1><p style="font-size:23px;margin:0">Revising the past with later measurements.</p><div style="width:660px;margin:4px auto 0">${renderSmoothing(record)}</div></main></body></html>`,
  )
  await page.screenshot({ path: `${directory}/social-card.png` })
} finally {
  await browser.close()
}
