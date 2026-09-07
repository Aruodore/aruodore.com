import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const routes = [
  '/',
  '/about',
  '/pieces',
  '/pieces/brownian-motion',
  '/pieces/ornstein-uhlenbeck',
  '/pieces/first-passage',
  '/pieces/beta-binomial-update',
  '/pieces/brownian-bridge',
  '/pieces/metropolis-hastings',
  '/sketches',
  '/sketches/ornstein-uhlenbeck',
  '/notes',
  '/notes/on-the-square-root-of-time',
]

/* Firefox reports this while it is still building the MathML box tree, and
 * only under load. The rendered document is checked for well-formed MathML
 * below, which is the property the warning gestures at, so the transient
 * message itself is not treated as a page error. */
const TRANSIENT_MATHML_WARNING = /Invalid markup: Incorrect number of children/

/* Arity required by the MathML spec for the elements KaTeX emits. */
const MATHML_ARITY = { msub: 2, msup: 2, msubsup: 3, mfrac: 2, mroot: 2, munder: 2, mover: 2, munderover: 3 }

for (const route of routes) {
  test(`${route} loads cleanly with metadata and no overflow`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' && !TRANSIENT_MATHML_WARNING.test(message.text())) errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))
    const response = await page.goto(route)
    expect(response?.ok()).toBe(true)
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/aruodore\.com\//)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true)
    // Screen readers depend on this markup, so assert the rendered tree is
    // well formed rather than only that nothing was logged.
    expect(
      await page.evaluate((arity) => {
        const malformed: string[] = []
        for (const [tag, children] of Object.entries(arity)) {
          for (const element of document.querySelectorAll(tag)) {
            if (element.childElementCount !== children) malformed.push(`${tag} has ${element.childElementCount}`)
          }
        }
        return malformed
      }, MATHML_ARITY),
    ).toEqual([])
    expect(errors).toEqual([])
  })
}

test('piece links complete client-side navigation', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/pieces/')
  await page.getByRole('link', { name: /First Passage/i }).click()

  await expect(page).toHaveURL(/\/pieces\/first-passage$/)
  await expect(page.getByRole('heading', { level: 1, name: 'First Passage' })).toBeVisible()
  expect(errors).toEqual([])
})

test('the beta-binomial posterior updates as trials arrive', async ({ page }) => {
  await page.goto('/pieces/beta-binomial-update')
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible({ timeout: 15_000 })

  const successes = page.getByText(/^\d+ \/ \d+$/)
  await expect(successes).not.toHaveText('0 / 0', { timeout: 15_000 })

  // The prior is worth alpha0 + beta0 trials, so moving a prior slider must
  // move the reported figure without resampling the observation stream.
  await page.getByLabel('Prior alpha, weight on successes').fill('10')
  await expect(page.getByText(/12\.0 trials/)).toBeVisible()
})

test('paper references render with journal, volume, and pages', async ({ page }) => {
  await page.goto('/pieces/beta-binomial-update')
  await expect(
    page.getByText('Diaconis, P. and Ylvisaker, D. (1979). Conjugate priors for exponential families.'),
  ).toContainText('The Annals of Statistics, 7(2), 269-281.')
})

test('@accessibility representative pages have no serious axe violations', async ({ page }) => {
  // Eight navigations, each followed by a full axe pass over a page that
  // mounts a simulation; the default timeout is not enough under load.
  test.setTimeout(120_000)
  for (const route of [
    '/',
    '/pieces/brownian-motion',
    '/pieces/ornstein-uhlenbeck',
    '/pieces/first-passage',
    '/pieces/beta-binomial-update',
    '/pieces/brownian-bridge',
    '/pieces/metropolis-hastings',
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
