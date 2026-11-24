import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
const pieces = [
  { slug: 'bayesian-optimisation', title: 'Bayesian Optimisation', control: 'Evaluations available', value: '8' },
  { slug: 'particle-filtering', title: 'Particle Filtering', control: 'Inspect update', value: '8' },
  { slug: 'variational-inference', title: 'Variational Inference', control: 'Coordinate sweeps', value: '12' },
]
for (const piece of pieces) {
  test(`${piece.title} supports reduced motion, keyboard controls, reset, and mobile accessibility`, async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/pieces/${piece.slug}`)
    await expect(page.locator('figure img')).toBeVisible()
    await expect(page.locator('figure svg')).toHaveCount(0)
    await page.getByRole('button', { name: 'Run interactive', exact: true }).click()
    await page.getByRole('button', { name: 'Pause playback', exact: true }).click()
    await expect(page.locator('figure svg')).toBeVisible()
    const slider = page.getByRole('slider', { name: piece.control, exact: true })
    await slider.fill(piece.value)
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveValue(String(Number(piece.value) + 1))
    await page.getByRole('button', { name: 'Reset comparison' }).click()
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(page.locator('figure svg')).toHaveAttribute(
      'viewBox',
      piece.slug === 'variational-inference'
        ? '0 0 600 1020'
        : piece.slug === 'bayesian-optimisation'
          ? '0 0 600 900'
          : '0 0 600 780',
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual(
      [],
    )
    for (let i = 0; i < 3; i++) {
      await page.getByRole('navigation').getByRole('link', { name: 'Pieces', exact: true }).click()
      await page
        .getByRole('link', { name: new RegExp(piece.title) })
        .first()
        .click()
      await expect(page.getByRole('button', { name: 'Run interactive', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Run interactive', exact: true }).click()
      await page.getByRole('button', { name: 'Pause playback', exact: true }).click()
      await expect(page.locator('figure svg')).toHaveCount(1)
    }
    expect(errors).toEqual([])
  })
  test(`${piece.title} has a readable static figure without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    try {
      const page = await context.newPage()
      await page.goto(`http://127.0.0.1:4173/pieces/${piece.slug}`)
      await expect(page.locator('figure img')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'What is the math?', exact: true })).toBeVisible()
      expect(await page.locator('math').count()).toBeGreaterThan(4)
    } finally {
      await context.close()
    }
  })
}

for (const piece of pieces) {
  test(`@visual ${piece.title} default and mobile figures`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1200, height: 1000 })
    await page.goto(`/pieces/${piece.slug}`)
    await page.getByRole('button', { name: 'Run interactive', exact: true }).click()
    await page.getByRole('button', { name: 'Pause playback', exact: true }).click()
    await page.getByRole('button', { name: 'Reset comparison' }).click()
    await page.evaluate(() => document.fonts.ready)
    await expect(page.locator('figure')).toHaveScreenshot(`${piece.slug}-desktop.png`)
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(page.locator('figure svg')).toHaveAttribute(
      'viewBox',
      piece.slug === 'variational-inference'
        ? '0 0 600 1020'
        : piece.slug === 'bayesian-optimisation'
          ? '0 0 600 900'
          : '0 0 600 780',
    )
    await expect(page.locator('figure')).toHaveScreenshot(`${piece.slug}-mobile.png`)
  })
}

for (const motion of [
  { slug: 'bayesian-optimisation', control: 'Evaluations available', key: 'mean', attribute: 'd' },
  { slug: 'particle-filtering', control: 'Inspect update', key: 'rug-particle-0', attribute: 'cx' },
  { slug: 'variational-inference', control: 'Coordinate sweeps', key: 'q-1', attribute: 'd' },
]) {
  test(`${motion.slug} moves continuously and holds its frame when paused`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/pieces/${motion.slug}`)
    await page.locator('figure').scrollIntoViewIfNeeded()
    const control = page.getByRole('slider', { name: motion.control, exact: true })
    const initial = Number(await control.inputValue())
    await page.getByRole('button', { name: 'Run interactive', exact: true }).click()
    await page.locator('figure').evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await page.waitForFunction(
      ([label, start]) =>
        Number(document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!.value) > Number(start),
      [motion.control, initial] as const,
    )
    const sample = await page.evaluate(async ({ key, attribute }) => {
      const selector = `[data-motion="${key}"]`
      const node = document.querySelector(selector)!
      const values: (string | null)[] = []
      const initialValue = node.getAttribute(attribute)
      await new Promise<void>((resolve) => {
        const frame = () => {
          const value = node.getAttribute(attribute)
          if (values.length || value !== initialValue) values.push(value)
          if (values.length < 12) requestAnimationFrame(frame)
          else resolve()
        }
        requestAnimationFrame(frame)
      })
      return { unique: new Set(values).size, persistent: node === document.querySelector(selector) }
    }, motion)
    expect(sample.unique).toBeGreaterThan(3)
    expect(sample.persistent).toBe(true)
    await page.getByRole('button', { name: 'Pause playback', exact: true }).click()
    const node = page.locator(`[data-motion="${motion.key}"]`)
    const frozen = await node.getAttribute(motion.attribute)
    await page.waitForTimeout(250)
    expect(await node.getAttribute(motion.attribute)).toBe(frozen)
  })
}

for (const piece of [
  { slug: 'bayesian-optimisation', control: 'Evaluations available', step: 'Evaluate suggested input' },
  { slug: 'particle-filtering', control: 'Inspect update', step: 'Run next update' },
  { slug: 'variational-inference', control: 'Coordinate sweeps', step: 'Fit next sweep' },
]) {
  test(`${piece.slug} completes one requested update and pauses`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/pieces/${piece.slug}`)
    await page.getByRole('button', { name: 'Run interactive', exact: true }).click()
    await page.getByRole('button', { name: 'Pause playback', exact: true }).click()
    await page.getByRole('button', { name: 'Reset comparison' }).click()
    const slider = page.getByRole('slider', { name: piece.control, exact: true })
    const initial = Number(await slider.inputValue())
    await page.getByRole('button', { name: piece.step, exact: true }).click()
    await page.locator('figure').evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await expect(slider).toHaveValue(String(initial + 1))
    await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(500)
    await expect(slider).toHaveValue(String(initial + 1))
  })
}
