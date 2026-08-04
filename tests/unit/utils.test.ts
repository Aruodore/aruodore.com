import { describe, expect, it } from 'vitest'
import { createBibtex, createCitation } from '../../utils/citation'
import { formatDay, formatMonth } from '../../utils/date'

const details = {
  title: 'A Test: Result',
  author: 'Ada Lovelace',
  published: '2026-08-03',
  version: '1.2.0',
  canonicalUrl: 'https://example.test/a',
}

describe('publication utilities', () => {
  it('formats valid and invalid dates', () => {
    expect(formatMonth('2026-08-03')).toBe('Aug 2026')
    expect(formatDay('2026-08-03')).toBe('Aug 3, 2026')
    expect(formatDay('not-a-date')).toBe('not-a-date')
    expect(formatMonth('not-a-date')).toBe('not-a-date')
  })

  it('creates canonical and DOI citations', () => {
    expect(createCitation(details)).toContain('2026. https://example.test/a.')
    expect(createCitation({ ...details, doi: '10.1/test' })).toContain('https://doi.org/10.1/test')
  })

  it('creates stable BibTeX keys and optional DOI fields', () => {
    expect(createBibtex(details)).toContain('@misc{adomi_a_test_result_2026')
    expect(createBibtex({ ...details, doi: '10.1/test' })).toContain('doi       = {10.1/test}')
  })
})
