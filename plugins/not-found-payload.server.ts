import { NOT_FOUND_SOURCE_ROUTE } from '~/utils/not-found-page'

// The prerendered 404 page is served at every unknown URL. On hydration the
// router prefers the payload's rendered path over the address bar, which
// would rewrite the visitor's URL to the internal source route.
export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.prerender) return
  nuxtApp.hook('app:rendered', ({ ssrContext }) => {
    if (ssrContext?.url === NOT_FOUND_SOURCE_ROUTE) delete ssrContext.payload.path
  })
})
