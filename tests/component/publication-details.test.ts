import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PublicationDetails from '../../components/publication-details.vue'

const props = {
  title: 'Test Piece',
  author: 'Ada',
  published: '2026-01-01',
  modified: '2026-02-01',
  version: '1.0.0',
  canonicalUrl: 'https://example.test',
  licenseUrl: 'https://license.test',
}

describe('publication-details', () => {
  it('keeps citation details collapsed until requested, then supports download and copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const wrapper = mount(PublicationDetails, { props })
    const trigger = wrapper.get('.citation-trigger')
    expect(trigger.text()).toContain('Cite this piece')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('#citation-panel').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('.citation-toggle').attributes('aria-hidden')).toBe('true')

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('#citation-panel').attributes('aria-hidden')).toBe('false')
    expect(wrapper.get('a[download]').attributes('href')).toContain('data:text/plain')
    await wrapper.get('.copy-citation').trigger('click')
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Test Piece'))
    expect(wrapper.get('.copy-citation').text()).toBe('Copied')

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('#citation-panel').attributes('aria-hidden')).toBe('true')
  })
})
