import { describe, expect, it } from 'vitest'
import { NOT_FOUND_SOURCE_ROUTE, writeServerRenderedNotFound } from '~/utils/not-found-page'

function notFoundError() {
  return Object.assign(new Error('[404] Not Found'), { statusCode: 404 })
}

describe('writeServerRenderedNotFound', () => {
  it('skips the client-only 404.html shell', () => {
    const route = { route: '/404.html', fileName: '/404.html' }
    writeServerRenderedNotFound(route)
    expect(route).toMatchObject({ skip: true })
  })

  it('writes the server-rendered not-found route as 404.html', () => {
    const route = { route: NOT_FOUND_SOURCE_ROUTE, fileName: '/__not-found/index.html', error: notFoundError() }
    writeServerRenderedNotFound(route)
    expect(route.fileName).toBe('/404.html')
    expect(route.error).toBeUndefined()
  })

  it('fails the build when the source route does not render a 404', () => {
    expect(() => writeServerRenderedNotFound({ route: NOT_FOUND_SOURCE_ROUTE })).toThrow(/got success/)
    const serverError = Object.assign(new Error('[500] Server Error'), { statusCode: 500 })
    expect(() => writeServerRenderedNotFound({ route: NOT_FOUND_SOURCE_ROUTE, error: serverError })).toThrow(/500/)
  })

  it('leaves every other route untouched', () => {
    const route = { route: '/pieces', fileName: '/pieces/index.html' }
    writeServerRenderedNotFound(route)
    expect(route).toEqual({ route: '/pieces', fileName: '/pieces/index.html' })
  })
})
