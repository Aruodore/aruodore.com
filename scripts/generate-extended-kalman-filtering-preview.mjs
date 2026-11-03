import { mkdirSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { chromium } from '@playwright/test'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/pieces/') && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return nextResolve(`${specifier}.ts`, context)
    return nextResolve(specifier, context)
  },
})
const { createRecord, DEFAULT_SETTINGS } = await import('../pieces/extended-kalman-filtering/model.ts')
const { renderFigure } = await import('../pieces/extended-kalman-filtering/figure.ts')
const directory = 'public/pieces/extended-kalman-filtering'
mkdirSync(directory, { recursive: true })
const record = createRecord()
const opening = { ...DEFAULT_SETTINGS, inspect: 80 }
writeFileSync(`${directory}/preview.svg`, renderFigure(record, opening, false, true))
writeFileSync(`${directory}/preview-mobile.svg`, renderFigure(record, opening, true, true))
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.setContent(
    `<html><body style="margin:0;background:#FAFAF7;color:#1A1A1A"><main style="padding:30px 48px;font-family:Georgia,serif"><div style="font:16px system-ui;color:#6B6B66">ARUODORE · PROBABILITY AND INFERENCE</div><h1 style="font-size:42px;font-weight:400;margin:14px 0 6px">Extended Kalman Filtering</h1><p style="font-size:23px;margin:0">A tangent to a nonlinear sensor.</p><div style="width:630px;margin:0 auto">${renderFigure(record, opening, false, true)}</div></main></body></html>`,
  )
  await page.screenshot({ path: `${directory}/social-card.png` })
} finally {
  await browser.close()
}
