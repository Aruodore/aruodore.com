import { expect, test } from '@playwright/test'

test.describe('3D interactives', () => {
  test('Brownian fallback full screen exits with Escape and restores focus', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined })
    })
    await page.goto('/pieces/brownian-motion')
    const enter = page.getByRole('button', { name: 'Enter full screen' })
    await expect(enter).toBeVisible({ timeout: 15_000 })
    await enter.click()
    const workspace = page.locator('[data-fullscreen-fallback]')
    await expect(workspace).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(workspace).toHaveCount(0)
    await expect(enter).toBeFocused()
  })

  test('OU parameters and simulation state survive mobile sheet transitions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined })
    })
    await page.goto('/pieces/ornstein-uhlenbeck')
    const enter = page.getByRole('button', { name: 'Enter full screen' })
    await expect(enter).toBeVisible({ timeout: 15_000 })
    const theta = page.getByLabel('Mean reversion strength theta').first()
    await theta.fill('1.25')
    await enter.click()
    const handle = page.getByRole('button', { name: /Controls/ })
    await expect(handle).toHaveAttribute('aria-expanded', 'false')
    await handle.click()
    await expect(handle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByLabel('Mean reversion strength theta').last()).toHaveValue('1.25')
    await page.getByRole('button', { name: 'Exit', exact: true }).click()
    await expect(enter).toBeFocused()
    await expect(theta).toHaveValue('1.25')
  })

  test('mobile sheet responds to vertical swipe', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.addInitScript(() => {
      Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined })
    })
    await page.goto('/pieces/brownian-motion')
    await page.getByRole('button', { name: 'Enter full screen' }).click({ timeout: 15_000 })
    const handle = page.getByRole('button', { name: /Controls/ })
    const box = await handle.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + 20, box!.y + 20)
    await page.mouse.down()
    await page.mouse.move(box!.x + 20, box!.y - 80, { steps: 5 })
    await page.mouse.up()
    await expect(handle).toHaveAttribute('aria-expanded', 'true')
  })
})
