const entries = [
  {
    title: 'Ornstein–Uhlenbeck Process: Mean Reversion and the Stationary Distribution',
    url: 'https://aruodore.com/pieces/ornstein-uhlenbeck',
    date: '2026-08-01T00:00:00Z',
    summary: 'An interactive explanation of mean reversion, exact transition sampling, and the stationary Gaussian distribution.',
  },
  {
    title: 'Brownian Motion Simulation: Paths, Variance, and the Heat Equation',
    url: 'https://aruodore.com/pieces/brownian-motion',
    date: '2026-05-23T00:00:00Z',
    summary: 'An interactive explanation connecting Brownian paths, ensemble distributions, diffusive scaling, and the heat equation.',
  },
]

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]!)
}

export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'application/atom+xml; charset=utf-8')
  const body = entries.map(entry => `<entry><title>${escapeXml(entry.title)}</title><id>${entry.url}</id><link href="${entry.url}"/><updated>${entry.date}</updated><summary>${escapeXml(entry.summary)}</summary></entry>`).join('')
  return `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Aruodore</title><id>https://aruodore.com/</id><link href="https://aruodore.com/feed.xml" rel="self"/><link href="https://aruodore.com/"/><updated>2026-08-01T00:00:00Z</updated><author><name>Lucas Aruodore Adomi</name></author>${body}</feed>`
})
