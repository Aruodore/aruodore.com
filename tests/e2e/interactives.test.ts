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

test.describe('2D interactives', () => {
  test('Metropolis chain reports diagnostics and restarts on a new proposal width', async ({ page }) => {
    await page.goto('/pieces/metropolis-hastings')
    const canvas = page.getByRole('img', { name: /empirical histogram of Metropolis draws/ })
    await expect(canvas).toBeVisible({ timeout: 15_000 })

    const drawCount = page.getByText(/^n = \d+/)
    await expect(drawCount).not.toHaveText('n = 0', { timeout: 15_000 })

    await page.getByLabel('Proposal standard deviation sigma').fill('2.5')
    await expect(page.getByText('2.50', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Restart chain' }).click()
    await page.getByRole('button', { name: 'New seed' }).click()
    await expect(canvas).toBeVisible()
  })

  test('Metropolis chain stays usable at the narrowest supported width', async ({ page }) => {
    // 20rem is the body min-width, so this is the narrowest layout the site
    // supports; the piece falls back to short panel captions below 620px.
    await page.setViewportSize({ width: 320, height: 653 })
    await page.goto('/pieces/metropolis-hastings')
    const figure = page.locator('figure').first()
    await expect(figure).toBeVisible({ timeout: 15_000 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true)

    // The chain is idle until the figure is on screen, then advances.
    const drawn = page.getByText(/^n = /)
    await expect(drawn).toHaveText('n = 0')
    await figure.scrollIntoViewIfNeeded()
    await expect(drawn).not.toHaveText('n = 0', { timeout: 15_000 })

    for (const name of ['Restart chain', 'New seed']) {
      const button = page.getByRole('button', { name })
      await expect(button).toBeVisible()
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('Brownian bridge controls update and replay conditioning', async ({ page }) => {
    await page.goto('/pieces/brownian-bridge')
    const canvas = page.getByRole('img', { name: /Paired navy Brownian bridge paths/ })
    await expect(canvas).toBeVisible({ timeout: 15_000 })

    await page.getByLabel('Terminal endpoint b').fill('1.25')
    await expect(page.getByText('1.25', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Replay conditioning' }).click()
    await page.getByRole('button', { name: 'New paths' }).click()
    await expect(canvas).toBeVisible()
  })
})
