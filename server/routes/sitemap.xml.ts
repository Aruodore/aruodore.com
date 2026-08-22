const paths = [
  '/',
  '/about',
  '/pieces',
  '/pieces/brownian-motion',
  '/pieces/ornstein-uhlenbeck',
  '/pieces/first-passage',
  '/pieces/beta-binomial-update',
  '/sketches',
  '/sketches/ornstein-uhlenbeck',
  '/notes',
  '/notes/on-the-square-root-of-time',
]

export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  const urls = paths.map((path) => `  <url><loc>https://aruodore.com${path}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
})
