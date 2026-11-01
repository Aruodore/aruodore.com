import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Vercel serves the generated 404.html for any unknown URL. The local static
// server has no such fallback, so load that file directly.
test('@accessibility the not-found page is styled, accessible, and leads back into the site', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/404.html')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(page).toHaveTitle('Page not found · Aruodore')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Pieces', exact: true })).toBeVisible()

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([])

  await page.getByRole('link', { name: 'Browse all pieces' }).click()
  await expect(page).toHaveURL(/\/pieces$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Pieces' })).toBeVisible()
  expect(errors).toEqual([])
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('the not-found page is server-rendered', async ({ page }) => {
    await page.goto('/404.html')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Browse all pieces' })).toHaveAttribute('href', '/pieces')
  })
})

test('hydrating the not-found page keeps the address the visitor requested', async ({ page }) => {
  await page.goto('/404.html')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/404.html')
})
