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
  it('renders citation metadata, downloads BibTeX, and copies the citation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const wrapper = mount(PublicationDetails, { props })
    expect(wrapper.text()).toContain('How to cite this piece')
    expect(wrapper.get('a[download]').attributes('href')).toContain('data:text/plain')
    await wrapper.get('button').trigger('click')
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Test Piece'))
    expect(wrapper.get('button').text()).toBe('Copied')
  })
})
