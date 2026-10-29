import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function showComparison(page: Page) {
  await page.getByRole('button', { name: 'Run simulation', exact: true }).click()
  await page.getByRole('button', { name: 'Pause playback' }).click()
  await page.getByRole('button', { name: 'Reset comparison' }).click()
}

test('smoothing revises the past, supports keyboard input, and resets after navigation', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/pieces/kalman-smoothing')
  await showComparison(page)
  const figure = page.getByRole('img', { name: 'Filtering and smoothing across a measurement gap', exact: true })
  await expect(figure).toBeVisible({ timeout: 15_000 })
  const cutoff = page.getByRole('slider', { name: 'Measurements available through' })
  const filtered = page.getByText('Filtered position, 95% interval', { exact: true }).locator('..').locator('dd')
  const smoothed = page.getByText('Smoothed position, 95% interval', { exact: true }).locator('..').locator('dd')
  const originalFilter = await filtered.textContent(),
    originalSmoother = await smoothed.textContent()
  await cutoff.fill('60')
  await expect(filtered).toHaveText(originalFilter!)
  await expect(smoothed).not.toHaveText(originalSmoother!)
  await cutoff.focus()
  await page.keyboard.press('ArrowRight')
  await expect(cutoff).toHaveValue('61')
  await page.getByRole('slider', { name: 'Inspect state at' }).fill('61')
  await expect(smoothed).toHaveText((await filtered.textContent())!)
  await page.getByRole('button', { name: 'Measurement gap', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Measurement gap', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await page.getByRole('button', { name: 'Reset comparison' }).click()
  await expect(smoothed).toHaveText(originalSmoother!)
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('navigation').getByRole('link', { name: 'Pieces', exact: true }).click()
    await page
      .getByRole('link', { name: /Kalman Smoothing/ })
      .first()
      .click()
    await showComparison(page)
    await expect(figure).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('figure svg')).toHaveCount(1)
    await expect(cutoff).toHaveValue('100')
  }
  expect(errors).toEqual([])
})

test('@accessibility smoothing is readable and operable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/pieces/kalman-smoothing')
  await expect(page.locator('figure svg')).toHaveAttribute('viewBox', '0 0 600 680')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.locator('math').count()).toBeGreaterThan(0)
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(audit.violations).toEqual([])
})

test('@visual smoothing default and truncated evidence', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1200, height: 900 })
  await page.goto('/pieces/kalman-smoothing')
  await showComparison(page)
  await expect(page.locator('figure svg')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('figure')).toHaveScreenshot('kalman-smoothing-full-record.png')
  await page.getByRole('slider', { name: 'Measurements available through' }).fill('60')
  await expect(page.locator('figure')).toHaveScreenshot('kalman-smoothing-before-return.png')
  await page.getByRole('button', { name: 'Reset comparison' }).click()
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(page.locator('figure svg')).toHaveAttribute('viewBox', '0 0 600 680')
  await expect(page.locator('figure')).toHaveScreenshot('kalman-smoothing-mobile.png')
})

test('the first playback reveals both estimates forwards once and holds the result', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/pieces/kalman-smoothing')
  await expect(page.getByRole('button', { name: 'Pause playback' })).toBeVisible({ timeout: 15_000 })
  const cutoff = page.getByRole('slider', { name: 'Measurements available through' })
  const inspect = page.getByRole('slider', { name: 'Inspect state at' })
  await page.locator('figure').evaluate((element) => element.scrollIntoView({ block: 'start' }))
  await expect(async () => expect(Number(await inspect.inputValue())).toBeGreaterThan(3)).toPass({ timeout: 10_000 })
  await expect(cutoff).toHaveValue('100')
  await page.getByRole('button', { name: 'Pause playback' }).click()
  const paused = await inspect.inputValue()
  await page.waitForTimeout(300)
  await expect(inspect).toHaveValue(paused)
  await page.getByRole('button', { name: 'Play sequence' }).click()
  await page.locator('figure').evaluate((element) => element.scrollIntoView({ block: 'start' }))
  await expect(async () => expect(Number(await inspect.inputValue())).toBeGreaterThan(Number(paused))).toPass()
  await expect(page.getByRole('status').filter({ hasText: 'Smoothing complete.' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Play sequence' })).toBeVisible()
  await page.waitForTimeout(2500)
  await expect(inspect).toHaveValue('100')
  await expect(cutoff).toHaveValue('100')
})
