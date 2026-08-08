import { SITE_AUTHOR } from './identity'

export interface CitationDetails {
  title: string
  author: string
  published: string
  version: string
  canonicalUrl: string
  doi?: string
}

export function createCitation(details: CitationDetails): string {
  const year = details.published.slice(0, 4)
  const location = details.doi ? `https://doi.org/${details.doi}` : details.canonicalUrl
  return `${details.author}. “${details.title}.” Aruodore, version ${details.version}, ${year}. ${location}.`
}

export function createBibtex(details: CitationDetails): string {
  const keyTitle = details.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  const year = details.published.slice(0, 4)
  const citationAuthor = details.author === SITE_AUTHOR.fullName ? SITE_AUTHOR.citationName : details.author
  const doi = details.doi ? `\n  doi       = {${details.doi}},` : ''
  return `@misc{adomi_${keyTitle}_${year},\n  author    = {${citationAuthor}},\n  title     = {${details.title}},\n  year      = {${year}},\n  version   = {${details.version}},\n  publisher = {Aruodore},${doi}\n  url       = {${details.canonicalUrl}},\n  note      = {Interactive mathematical explanation and browser-based simulation}\n}`
}
