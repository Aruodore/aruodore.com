import { defineContentConfig, defineCollection, z } from '@nuxt/content'

// Three content collections. Each has a strict frontmatter schema —
// adding a piece, sketch, or note that doesn't conform fails the build.

const referenceSchema = z.object({
  kind: z.enum(['book', 'paper', 'preprint']),
  author: z.string(),
  title: z.string(),
  year: z.number().int(),
  venue: z.string().optional(),  // publisher (book) or journal name (paper)
  url: z.string().url().optional(),
})

export default defineContentConfig({
  collections: {
    pieces: defineCollection({
      type: 'page',
      source: 'pieces/*.md',
      schema: z.object({
        title: z.string(),
        slug: z.string(),
        published: z.string(),                                  // ISO date
        summary: z.string(),
        math_topics: z.array(z.string()).default([]),
        techniques: z.array(z.string()).default([]),
        references: z.array(referenceSchema).default([]),
        preview_video: z.string().optional(),
        preview_image: z.string().optional(),
        source_url: z.string().url().optional(),
      }),
    }),

    sketches: defineCollection({
      type: 'page',
      source: 'sketches/*.md',
      schema: z.object({
        title: z.string(),
        slug: z.string(),
        published: z.string(),
        equation_latex: z.string(),
        distribution_or_process: z.string(),
        one_sentence_description: z.string(),
        preview_clip: z.string().optional(),
      }),
    }),

    notes: defineCollection({
      type: 'page',
      source: 'notes/*.md',
      schema: z.object({
        title: z.string(),
        slug: z.string(),
        published: z.string(),
        topics: z.array(z.string()).default([]),
      }),
    }),
  },
})
