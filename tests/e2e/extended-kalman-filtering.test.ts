import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.setTimeout(60_000)

test('EKF remains readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:4173/pieces/extended-kalman-filtering')
    await expect(page.locator('figure img')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'What is the math?', exact: true })).toBeVisible()
    expect(await page.locator('math').count()).toBeGreaterThan(5)
  } finally {
    await context.close()
  }
})

test('EKF inspection responds to keyboard input and survives three route changes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/pieces/extended-kalman-filtering')
  const svg = page.locator('figure svg')
  await page.getByRole('button', { name: 'Run filter', exact: true }).click()
  await expect(svg).toBeVisible()
  const inspect = page.getByRole('slider', { name: 'Inspect measurement' })
  await inspect.fill('50')
  await inspect.focus()
  await page.keyboard.press('ArrowRight')
  await expect(inspect).toHaveValue('51')
  await expect(svg.locator('desc')).toContainText('2.55 seconds')
  await page.getByRole('slider', { name: 'Release angle', exact: true }).fill('2.4')
  await page.getByRole('button', { name: 'New noise sample' }).click()
  await page.getByRole('button', { name: 'Reset comparison' }).click()
  await expect(inspect).toHaveValue('1')
  for (let i = 0; i < 3; i++) {
    await page.getByRole('navigation').getByRole('link', { name: 'Pieces', exact: true }).click()
    await page
      .getByRole('link', { name: /Extended Kalman Filtering/ })
      .first()
      .click()
    await expect(page.getByRole('button', { name: 'Run filter', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Run filter', exact: true }).click()
    await page.getByRole('button', { name: 'Pause tracking', exact: true }).click()
    await page.getByRole('button', { name: 'Restart tracker', exact: true }).click()
    await expect(svg).toHaveCount(1)
    await expect(inspect).toHaveValue('1')
  }
  expect(errors).toEqual([])
})

test('@accessibility EKF equations and controls work on mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/pieces/extended-kalman-filtering')
  await page.getByRole('button', { name: 'Run filter', exact: true }).click()
  await page.getByRole('button', { name: 'Pause tracking', exact: true }).click()
  await expect(page.locator('figure svg')).toHaveAttribute('viewBox', '0 0 440 660')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.locator('math').count()).toBeGreaterThan(5)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
})

test('@visual EKF default, ambiguous sensor, and mobile figures', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1200, height: 900 })
  await page.goto('/pieces/extended-kalman-filtering')
  await page.getByRole('button', { name: 'Run filter', exact: true }).click()
  await page.getByRole('slider', { name: 'Inspect measurement' }).fill('80')
  await expect(page.locator('figure svg')).toBeVisible()
  await expect(page.locator('figure')).toHaveScreenshot('ekf-default.png')
  await page.getByRole('slider', { name: 'Initial angle uncertainty' }).fill('1.2')
  await expect(page.locator('figure')).toHaveScreenshot('ekf-broad-prior.png')
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(page.locator('figure svg')).toHaveAttribute('viewBox', '0 0 440 660')
  await expect(page.locator('figure')).toHaveScreenshot('ekf-mobile.png')
})

test('EKF starts playing on first entry and can be paused and restarted', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/pieces/extended-kalman-filtering')
  await expect(page.getByRole('button', { name: 'Pause tracking', exact: true })).toBeVisible()
  await page.locator('figure').scrollIntoViewIfNeeded()
  const inspect = page.getByRole('slider', { name: 'Inspect measurement' })
  const opening = Number(await inspect.inputValue())
  expect(opening).toBeGreaterThanOrEqual(80)
  await expect(async () => expect(Number(await inspect.inputValue())).toBeGreaterThan(opening)).toPass()
  await page.getByRole('button', { name: 'Pause tracking', exact: true }).click()
  const paused = await inspect.inputValue()
  await page.waitForTimeout(200)
  await expect(inspect).toHaveValue(paused)
  await page.getByRole('button', { name: 'Restart tracker', exact: true }).click()
  await expect(inspect).toHaveValue('1')
})
