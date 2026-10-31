import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ErrorPage from '../../error.vue'

type HeadInput = () => { title: string; meta: { name: string; content: string }[] }

function render(statusCode: number) {
  const useHead = vi.fn<(input: HeadInput) => void>()
  const clearError = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('useHead', useHead)
  vi.stubGlobal('clearError', clearError)
  const wrapper = mount(ErrorPage, {
    props: { error: { statusCode } as never },
    global: { stubs: { 'nuxt-layout': { template: '<div><slot /></div>' } } },
  })
  const head = useHead.mock.calls[0]![0]()
  return { wrapper, head, clearError }
}

describe('error page', () => {
  it('explains a missing page, keeps it out of search results, and links back into the site', async () => {
    const { wrapper, head, clearError } = render(404)
    expect(wrapper.get('h1').text()).toBe('Page not found')
    expect(wrapper.text()).toContain('There is no page at this address.')
    expect(head.title).toBe('Page not found · Aruodore')
    expect(head.meta).toContainEqual({ name: 'robots', content: 'noindex' })

    const links = wrapper.findAll('a')
    expect(links.map((link) => link.attributes('href'))).toEqual(['/pieces', '/'])
    await links[0]!.trigger('click')
    expect(clearError).toHaveBeenCalledWith({ redirect: '/pieces' })
    await links[1]!.trigger('click')
    expect(clearError).toHaveBeenLastCalledWith({ redirect: '/' })
  })

  it('describes other failures without calling them missing pages', () => {
    const { wrapper, head } = render(500)
    expect(wrapper.get('h1').text()).toBe('Something went wrong')
    expect(wrapper.text()).not.toContain('There is no page at this address.')
    expect(head.title).toBe('Error · Aruodore')
  })
})
