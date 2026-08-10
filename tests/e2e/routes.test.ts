import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const routes = [
  '/',
  '/about',
  '/pieces',
  '/pieces/brownian-motion',
  '/pieces/ornstein-uhlenbeck',
  '/pieces/first-passage',
  '/sketches',
  '/sketches/ornstein-uhlenbeck',
  '/notes',
  '/notes/on-the-square-root-of-time',
]

for (const route of routes) {
  test(`${route} loads cleanly with metadata and no overflow`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))
    const response = await page.goto(route)
    expect(response?.ok()).toBe(true)
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/aruodore\.com\//)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true)
    expect(errors).toEqual([])
  })
}

test('@accessibility representative pages have no serious axe violations', async ({ page }) => {
  for (const route of [
    '/',
    '/pieces/brownian-motion',
    '/pieces/ornstein-uhlenbeck',
    '/pieces/first-passage',
    '/about',
  ]) {
    await page.goto(route)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([])
  }
})

test('feed, sitemap, robots, and internal links are valid', async ({ page, request }) => {
  for (const path of ['/feed.xml', '/sitemap.xml', '/robots.txt']) expect((await request.get(path)).ok()).toBe(true)
  await page.goto('/')
  const links = await page
    .locator('a[href^="/"]')
    .evaluateAll(
      (elements) => [...new Set(elements.map((element) => element.getAttribute('href')).filter(Boolean))] as string[],
    )
  for (const link of links) expect((await request.get(link)).status(), link).toBeLessThan(400)
})
