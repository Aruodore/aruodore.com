// Nuxt prerenders 404.html as a client-only shell, which stays blank until the
// client has queried the content database, and forever without JavaScript.
// Prerendering a route that matches no page yields the server-rendered error
// page instead, which is then written out as 404.html.
export const NOT_FOUND_SOURCE_ROUTE = '/__not-found'

interface PrerenderRoute {
  route: string
  fileName?: string
  error?: Error & { statusCode?: number }
  skip?: boolean
}

export function writeServerRenderedNotFound(route: PrerenderRoute): void {
  if (route.route === '/404.html') {
    route.skip = true
    return
  }
  if (route.route !== NOT_FOUND_SOURCE_ROUTE) return
  if (route.error?.statusCode !== 404) {
    throw new Error(
      `Expected ${NOT_FOUND_SOURCE_ROUTE} to render the 404 page, got ${route.error?.message ?? 'success'}`,
    )
  }
  delete route.error
  route.fileName = '/404.html'
}
