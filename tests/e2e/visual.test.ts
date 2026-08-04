import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }))

for (const [name, route] of [
  ['home', '/'],
  ['brownian', '/pieces/brownian-motion'],
  ['ou', '/pieces/ornstein-uhlenbeck'],
] as const) {
  test(`@visual ${name} stable reduced-motion view`, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.goto(route)
    await expect(page).toHaveScreenshot(`${name}-desktop.png`, { fullPage: true })
  })
}
