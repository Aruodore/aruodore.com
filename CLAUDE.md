# CLAUDE.md: Aruodore

This file is the source of truth for working on this repository. **Read it at the start of every session in this repo and confirm the rules before proposing any change.** It encodes the project's positioning, design system, technical stack, and the rules that make new work consistent with everything that came before. Suggestions that conflict with this document should be flagged and rejected unless the owner explicitly overrides them.

The document is long on purpose. If you are about to introduce a pattern, a color, a dependency, or a feature, search this file first.

---

## 1. What this site is

Aruodore is the public practice of a mathematician and statistician building systems that reason under uncertainty at the intersection of probability theory, statistical inference, computer vision, and machine learning, delivered as deployed services and pipelines, with interactive, browser-native pieces as the publicly visible portion.

The site is the owner's long-term professional asset: part research notebook, part gallery, part credential.

The implicit argument the site makes, through every design and content decision:

> Probability is not abstract: here, watch it move, watch it update, watch it converge.

One-sentence positioning:

> A mathematician and statistician who builds systems that reason under uncertainty.

### Audience

Researchers, ML engineers, creative technologists, serious science publications, AI labs, quant firms, and the small audience of people who care about the intersection of rigorous probability/statistics and beautiful interactive work.

**Not** for: general consumers, generic developers, the "creator economy."

---

## 2. What this site is NOT

These exclusions are not negotiable. Reject suggestions that introduce any of the following unless the owner explicitly overrides them:

- No services page, pricing, or "hire me" CTA.
- No newsletter signup.
- No social proof widgets, client logos, testimonials.
- No blog comments.
- No dark mode toggle. The site is light mode only and owns that decision.
- No animated page transitions. The work is the show, not the chrome.
- No carousel, hero with parallax, or marketing-site patterns.
- No CMS. Content is markdown in the repo, version controlled.
- No clever domain name. The site lives at the owner's real name.
- No component libraries (Nuxt UI, Vuetify, PrimeVue, shadcn ports, etc.). All components are hand-written.
- No analytics beyond Plausible, if any.

---

## 3. Site architecture (flat, ruthlessly simple)

Five sections. No more.

| Route              | Purpose                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                | Home. Name, one-line tagline, **curated landing** showing the most recent **8 pieces** with thumbnails. Sparser than the archive; designed to breathe. Most recent first. |
| `/pieces`          | **Full chronological archive of every piece.** Exhaustive, no curation, no item cap.                                                                                      |
| `/pieces/[slug]`   | Each deep interactive at its own URL. Interactive at the top; writeup, equations, references, and source link below.                                                      |
| `/sketches`        | Gallery of small looping statistical visualizations. Square tiles link to an equation, a live sketch, and a short paragraph.                                              |
| `/sketches/[slug]` | Detail page for one sketch.                                                                                                                                               |
| `/notes`           | Index of short-form writing: paper observations, half-formed ideas, small experiments. Chronological.                                                                     |
| `/notes/[slug]`    | Individual note.                                                                                                                                                          |
| `/about`           | Single page. Two paragraphs of plain prose. Who, what, email. No photo unless added later. No services menu.                                                              |

Home and `/pieces` are not redundant: home is **curated and breathes** (a landing, fewer items, more whitespace); `/pieces` is **exhaustive** (an archive, every piece, in order, indefinitely). If a future session asks why both exist, that is the answer.

If a proposed feature does not fit one of these five sections, it does not belong on the site.

---

## 4. Visual identity

The site is a hybrid: **quiet gallery** on the home page and piece pages (let the interactives breathe), **mathematical notebook** on notes and writeups (serif typography, equations rendered with care).

Design philosophy:

- The site disappears in service of the work.
- Restraint over decoration.
- Information density where it matters: charts, marginalia, citations.
- Lineage: Tufte, FT visual journalism, Distill.pub, Bartosz Ciechanowski, Inigo Quilez.
- Never looks like a template or a generic minimal portfolio.

### 4.1 Palette (LOCKED)

Every color used on the site must come from this list. **No exceptions.** Do not introduce new colors per piece. The consistency itself is part of the identity.

| Token       | Hex       | Semantic role                                    |
| ----------- | --------- | ------------------------------------------------ |
| `bg`        | `#FAFAF7` | Off-white, warm. Page background.                |
| `ink`       | `#1A1A1A` | Near-black. Primary text.                        |
| `muted`     | `#6B6B66` | Secondary text, captions, timestamps.            |
| `rule`      | `#D8D8D2` | Faint grid lines, rules, borders, divider lines. |
| `posterior` | `#1E3A5F` | Deep navy. **Posterior / inferred quantities.**  |
| `observed`  | `#C77B3C` | Warm orange. **Observed data.**                  |
| `prior`     | `#4A7A6A` | Muted teal. **Prior distributions.**             |

The three **signal colors** (`posterior`, `observed`, `prior`) carry consistent semantic meaning across every chart and accent on the site. If a piece visualises a Bayesian update, the prior is teal, the data is orange, the posterior is navy. Don't deviate even when "it would look nicer" with another color: the consistency is the point.

### 4.2 Typography

- **Body serif** with a strong figure (numeral) design. Currently Source Serif 4. Old-style figures (`onum`) in prose, lining figures (`lnum`) + tabular (`tnum`) in tables and plots.
- **Mono** for code and data: JetBrains Mono.
- **Sans-serif** for UI chrome and chart labels only. Kept minimal. Currently Inter.
- **KaTeX** for math, rendered at build time by `remark-math` + `rehype-katex` in the `@nuxt/content` pipeline (configured in `nuxt.config.ts`). Use markdown's `$…$` for inline math and `$$…$$` for display math. **Do not** introduce a Vue component named `Math`: it collides case-insensitively with the HTML5 `<math>` element that rehype-katex emits for MathML accessibility. Raw KaTeX HTML in templates is also forbidden.

Numbers in prose use proper typesetting:

- `95% CI [0.23, 0.41]`, always this format. Never "95% confidence interval of 0.23 to 0.41".
- `n = 1000` with `n` italicised. Other math variables similarly.
- Tabular figures in tables and decimal-aligned columns. Apply the `.tnum` class.

### 4.3 Layout

- Generous margins on prose pages.
- Wide pages may use a side column for marginalia (annotations, small plots, references) in the Tufte style.
- Small multiples as a structural device when comparing things.
- Two column-widths exist as locked tokens: `prose-column` (35rem) for prose, `wide-column` (64rem) for piece interactives.

### 4.4 Section grammar and chrome accents (LOCKED)

These rules codify the only places the site activates anything beyond `ink` / `muted` / `rule`. The locked palette of §4.1 is only meaningful once a visitor _sees_ the signal colors; the chrome activates the palette in the smallest deliberate way possible.

- **Mono kicker** (`font-sans uppercase tracking-widest text-xs text-muted`) is reserved for **metadata strips only**: a "Published 19 May 2026 · source" line on a piece, a "Markov chain Monte Carlo · 19 May 2026" line on a sketch, a "19 May 2026 · Brownian motion · scaling" line on a note. It is **never** used as a section heading. Page-level section headings are serif, in the same family as the body, sized one step above body and set in italic when the section names a category of work (e.g. _Pieces_, _References_).
- **Freshest-item accent.** On every chronological index (`/`, `/pieces`, `/notes`), all dates are rendered in `muted`. The first date is preceded by a small `observed` (warm orange) marker and accessible "Newest" text. The marker is the newest observation, meets 3:1 non-text contrast, and is never the only indication. Sketches index (a grid, not a chronological list) is excluded.
- **Active navigation.** The current section's nav link is rendered in `ink` with a 1px `posterior` (deep navy) underline at 6px offset. All other nav links are `muted`, no underline. The active state should change on route change without animation.

These three activations are the entirety of the signal-color usage on chrome. Charts and figures inside pieces are governed by §4.1.

---

## 5. Tech stack (DECIDED, do not debate)

| Layer          | Choice                                                                                 |
| -------------- | -------------------------------------------------------------------------------------- |
| Framework      | Nuxt 3 (Vue 3, Composition API, `<script setup>`)                                      |
| Content        | `@nuxt/content` v3, markdown collections defined in `content.config.ts`                |
| Math           | KaTeX at build time through the Markdown pipeline                                      |
| Styling        | **Tailwind CSS v4** (CSS-first config in `assets/css/main.css` via `@theme`)           |
| 3D             | Three.js for fast 3D pieces                                                            |
| Compute pieces | Raw WebGPU, written as framework-agnostic JS inside Vue components that mount a canvas |
| Build          | Static, `nuxt generate`                                                                |
| Hosting        | Cloudflare Pages or Vercel                                                             |
| Analytics      | Plausible, if any. Nothing else.                                                       |

Anti-stack (do not introduce):

- No `@nuxtjs/tailwindcss` module: Tailwind v4 uses the official Vite plugin.
- No component libraries.
- No CMS, comments, newsletter, dark-mode plugin.
- No PostCSS config file (Tailwind v4 owns CSS pipeline through `@tailwindcss/vite`).
- No `tailwind.config.ts` (Tailwind v4 is CSS-first; tokens live in `@theme`).

---

## 6. Repository layout

This repository is a standalone, single-site repo for `aruodore.com`. It was split out of a combined monorepo (which also held the separate `work.aruodore.com` and `journal.aruodore.com` projects) so that this site's source could be published openly without exposing the others. `work/` and `journal/` now live in their own private repos and are outside the scope of this document.

```
/
├─ CLAUDE.md                     ← this file. Source of truth for this repo.
├─ README.md
├─ CITATION.cff
├─ LICENSE                       ← MIT, covers the code (see §7 for content licensing)
├─ nuxt.config.ts                ← module list, head meta, CSS, prerender config
├─ content.config.ts             ← @nuxt/content collection schemas (strict)
├─ tsconfig.json                 ← strict TS, noUncheckedIndexedAccess
├─ package.json
├─ app.vue                       ← root mount; only the layout + NuxtPage
├─ layouts/
│  └─ default.vue                ← header nav, footer, page container
├─ pages/                        ← file-based routes
│  ├─ index.vue                  ← /
│  ├─ about.vue                  ← /about
│  ├─ pieces/index.vue           ← /pieces
│  ├─ pieces/[slug].vue          ← /pieces/:slug
│  ├─ sketches/index.vue         ← /sketches
│  ├─ sketches/[slug].vue        ← /sketches/:slug
│  ├─ notes/index.vue            ← /notes
│  └─ notes/[slug].vue           ← /notes/:slug
├─ components/
│  ├─ ui/                        ← shared UI primitives (Math, etc.)
│  └─ pieces/                    ← Vue mounts for interactive pieces (one .vue per piece)
├─ pieces/                       ← non-Vue simulation/rendering modules per piece
│  └─ [slug]/                    ← e.g. pieces/brownian-motion/simulation.ts
├─ composables/                  ← Vue composables (useX)
├─ utils/                        ← pure utility functions (math helpers, formatters)
├─ assets/
│  ├─ css/main.css               ← Tailwind v4 entry + @theme tokens + base/components
│  ├─ css/fonts.css              ← font imports
│  └─ fonts/                     ← (future) self-hosted .woff2
├─ content/
│  ├─ pieces/[slug].md
│  ├─ sketches/[slug].md
│  └─ notes/[slug].md
└─ public/
   ├─ favicon.svg
   ├─ pieces/[slug]/             ← per-piece preview videos, stills, assets
   └─ sketches/                  ← per-sketch preview clips
```

**The Vue/simulation split is load-bearing.** A piece's Vue component does three things only: mount a canvas, boot the simulation, clean up on unmount. The simulation module knows nothing about Vue; it could be lifted out of Nuxt entirely. See `components/pieces/brownian-motion.vue` + `pieces/brownian-motion/simulation.ts` for the reference implementation.

---

## 7. Content types and schemas

Content lives in `content/` and is validated by `content.config.ts` with `zod` schemas. **Frontmatter that does not match the schema fails the build.** Treat the schemas as canonical; if you need a new field, edit the schema in the same change.

### 7.1 `pieces/[slug].md`: deep interactives

Frontmatter (required unless noted):

```yaml
title: string
slug: string
published: ISO date (YYYY-MM-DD)
summary: one-sentence string
math_topics: [string] # e.g. ["Brownian motion", "stochastic differential equations"]
techniques: [string] # e.g. ["WebGPU", "compute shader"]
references: # at least 2–3 entries for most pieces
  [{ author: string, title: string, year: number, url?: string }]
preview_video: path # optional, looping clip on home/index
preview_image: path # optional, still fallback
source_url: url # link to GitHub source
```

Body: writeup with KaTeX math using Markdown `$…$` and `$$…$$`, embedded Vue components for the interactive (MDC `::ComponentName` syntax), citations in inline author-year format. Do not render `equation_latex` through a Vue component.

The writeup answers, in this order:

1. **What is this?**
2. **What is the math?**
3. **Why is it interesting?**
4. **How was it built?**

### 7.2 `sketches/[slug].md`: small looping visualisations

```yaml
title: string
slug: string
published: ISO date
equation_latex: string # the equation in LaTeX, no $$ wrapping
distribution_or_process: string # e.g. "Ornstein–Uhlenbeck process"
one_sentence_description: string
preview_clip: path # optional
```

Body: optional, usually 1–2 paragraphs. Sketches are not mini-pieces. They are: one equation, one sentence, the visual.

### 7.3 `notes/[slug].md`: short writing

```yaml
title: string
slug: string
published: ISO date
topics: [string]
```

Body: markdown prose, 200–800 words usually. Can include KaTeX math. Longer-form thinking goes into pieces, not notes.

---

## 8. The interactive piece pattern

Every deep interactive follows the same pattern. Deviating from it is a smell, flag it.

1. **Vue mount** at `components/pieces/[PieceName].vue`:
   - Provides a `<canvas>` (or `<div>` host).
   - Calls the simulation module in `onMounted`.
   - Calls `destroy()` in `onBeforeUnmount`.
   - Wraps the canvas in `<ClientOnly>` if the simulation touches `window`/`document`.
   - Owns the UI controls (reset buttons, sliders) and forwards values to the simulation.

2. **Simulation module** at `pieces/[slug]/simulation.ts` (or peer files):
   - Pure JS/TS, framework-agnostic. **No Vue imports.**
   - Exports a single mount function `mount[Name](canvas, opts) => Handle` where `Handle` has at least `destroy()` and any piece-specific control methods.
   - Owns the requestAnimationFrame loop, particle state, WebGL/WebGPU/Three.js resources, event listeners.
   - Cleans up everything on `destroy()`: cancel rAF, remove listeners, dispose Three.js resources, destroy WebGPU contexts, free buffers.

3. **Content writeup** at `content/pieces/[slug].md`:
   - Frontmatter as in §7.1.
   - Body embeds the Vue mount with MDC syntax: `::PieceName\n::`.

4. **Assets** at `public/pieces/[slug]/`:
   - `preview.svg` or `preview.png` (still).
   - `preview.mp4` or `.webm` (loop) if applicable.
   - Any shaders, textures, datasets the piece needs.

**Cleanup is not optional.** A piece that leaks a rAF loop on route change is broken. Verify by clicking into the piece, navigating away, then back, several times in dev tools: memory should be stable.

**SSR safety:** the simulation module must not run at SSR time. Either wrap it in `<ClientOnly>` or guard it with `onMounted` (which only fires on the client). Importing the simulation module at the top of a `.vue` file is fine as long as `mount[Name]` is only called inside `onMounted`.

### 8.1 Legitimate deviations from the standard pattern

The standard pattern above is the default, but some content demands a different shape. Recognised deviations:

- **Essay-with-sketches.** A piece that is primarily prose with several small embedded interactives rather than one dominant interactive. No single `components/pieces/[Name].vue` is required; the markdown embeds multiple smaller components instead.
- **Static visualisation.** A piece whose content is a static chart or composition rather than a simulation. No rAF loop and no `destroy()` is required, but the component must still mount cleanly and SSR-safely.
- **Data-driven piece.** A piece that loads a dataset rather than generating its content. The dataset lives at `public/pieces/[slug]/data/` and is fetched on the client (not bundled).

In all deviations: the writeup still follows the four-question structure (§7.1), the frontmatter still validates against the schema, and the §12.1 definition of done still applies, adapted as needed (e.g. "60 fps frame rate" does not apply to a static chart).

---

## 9. Coding rules

- **TypeScript everywhere. Strict mode.** `noUncheckedIndexedAccess` is on: handle the `undefined` cases.
- **Vue Composition API with `<script setup>`.** No Options API.
- Components are small and focused. **If a component exceeds ~200 lines, it's probably doing too much.** Split it.
- **Comments, scope-dependent rule.** Simulation code under `pieces/[slug]/` includes comments explaining the **mathematics**, the _what_, not only the _why_, because the math _is_ the content. A reader who knows the math should be able to follow the simulation from the comments alone. Everything else (Vue components, composables, utilities, pages, layouts) follows the default: **no comments unless the _why_ is non-obvious**, a hidden constraint, a subtle invariant, a workaround. Do not narrate what the code does.
- Variables in simulation code use mathematical naming where it aids clarity: `mu`, `sigma`, `dt`, `N`, `theta`. Readable to anyone who knows the math, not just the codebase.
- **No magic numbers in simulation code.** Constants are named and documented.
- Tailwind v4 utilities only use tokens from §4.1: `bg-bg`, `text-ink`, `text-muted`, `border-rule`, `text-posterior`, etc. If a class references a color outside the palette, the build is silently wrong.
- No `any`. If a third-party type is missing, write a minimal `.d.ts`.
- No global state. Use composables when state needs to be shared.

### 9.1 File and component naming

- Name every repository-owned file in lowercase kebab-case, including Vue components, composables, scripts, documentation, tests, and static assets.
- Exceptions are permitted only when required by a framework, operating system, package manager, legal convention, or development tool. Current exceptions: `CLAUDE.md` (Claude instructions), `LICENSE` (legal convention), `README.md` and `CITATION.cff` (GitHub/Citation File Format conventions requiring exact casing), `package.json` and `package-lock.json` (npm), `tsconfig.json` (TypeScript), `.prettierrc.json` (Prettier), Nuxt route parameters such as `[slug].vue`, dotfiles, and GitHub-required paths under `.github/`.
- Use kebab-case for component tags and MDC component names wherever the framework permits it, including Nuxt built-ins.
- Use PascalCase only for TypeScript component variables when the language or API requires it; TypeScript functions, interfaces, types, and imports follow normal TypeScript naming conventions.

### 9.2 Testing and definition of done

- Every production behavior and moving part requires proportionate automated coverage: unit tests for pure logic, component tests for Vue behavior, integration tests for module boundaries, end-to-end tests for critical journeys, deterministic visual tests for important states, accessibility tests for semantic UI, and measurable budgets for performance-sensitive behavior.
- Every bug fix includes a regression test that fails before the fix.
- Tests must contain meaningful assertions, surface unexpected errors, and may not be disabled with `.only`, `.skip`, or equivalent committed focus controls.
- Prefer observable behavior over implementation details. Mock system boundaries, not the behavior under test.
- Coverage is a backstop rather than evidence by itself. The repository ratchet is 90% lines/statements, 85% functions, and 80% branches; critical small state machines require complete meaningful branch coverage.
- Production work is complete only when `npm run verify` passes. Changes affecting browser behavior also require the relevant Playwright, accessibility, visual, and performance suites.

### 9.3 Substantial 3D interactives

Every substantial 3D interactive must provide:

- A full-screen workspace that preserves the live canvas and simulation state.
- An accessible, explicit exit action and support for Escape.
- A fixed-viewport fallback when native element full screen is unavailable.
- Mobile controls appropriate to the interaction, with safe-area spacing and 44px minimum touch targets.
- Visible interaction guidance for orbit, zoom, reset, and exiting full screen.

---

## 10. Content rules

- Every piece has the math visible. Equations are not decoration; they are part of the content.
- Numbers in prose use proper typesetting (see §4.2). Tabular figures in tables.
- **Writing tone:** precise, cautious about claims, attentive to uncertainty, allergic to overstatement. Closer to Andrew Gelman's blog texture than to Medium tech writing. If a sentence starts with "Imagine if…" or "What if I told you…", delete it.
- Each piece writeup follows the four-question order in §7.1.
- Sketches are minimal: one equation, one sentence, the visual. They are not mini-pieces. Do not let them grow.
- Notes are short, 200–800 words usually. Longer-form thinking goes into pieces.
- Prose is direct and specific. Avoid slogans and repetitive contrast formulas. **Never use em dashes anywhere in the repository:** not in prose, not in docs, not in code comments. Rewrite with a comma, colon, period, or parentheses instead.

### 10.1 Citations (locked format)

Citations are formatted consistently across every piece. Most pieces have at least 2–3 references.

**Inline (in prose):**

- One author: `(Author Year)`, e.g. `(Gelman 2013)`.
- Two authors: `(Author and Author Year)`, e.g. `(Karatzas and Shreve 1991)`.
- Three or more: `(Author et al. Year)`, e.g. `(Vaswani et al. 2017)`.
- Multiple citations in one parenthesis: separated by semicolons in chronological order, e.g. `(MacKay 2003; Gelman 2013)`.

**Full references (bottom of each piece):**

Author last name, initial(s), year, then the title. **Book titles in italics; paper titles in roman.** Then publisher (for books) or journal name with volume/pages (for papers). URL if available, last.

- Book: `Karatzas, I. and Shreve, S. (1991). *Brownian Motion and Stochastic Calculus.* Springer.`
- Paper: `Vaswani, A. et al. (2017). Attention is all you need. *Advances in Neural Information Processing Systems*, 30. https://arxiv.org/abs/1706.03762`
- Pre-print or web reference: `Author, X. (Year). Title. URL.`

The frontmatter `references` array (see §7.1) feeds the rendered list at the bottom of the piece: the formatting above is what the rendered output must look like, regardless of how it is templated.

### 10.5 Accessibility

- **Static fallback.** Every piece must remain useful to a reader who cannot run the interactive. The `preview_image` in frontmatter serves as the visual fallback, but the writeup itself must stand alone: the math, the explanation, and the references should convey the piece without the canvas running.
- **Reduced motion.** Server-rendered interactive figures begin with their static preview. After the browser resolves the visitor's preference, motion may start automatically only when reduced motion is not requested. Otherwise the still remains until an explicit Run control is used.
- **Lifecycle.** Canvas simulations pause when outside the viewport or while the document is hidden. A failed WebGL mount leaves the preview visible with a short explanation.
- **Contrast.** Prose contrast against the `bg` token must meet WCAG AA. The locked palette in §4.1 satisfies this; verify if a new token is ever proposed (and reject if it doesn't).
- **Keyboard.** Interactive controls (buttons, sliders, reset) must be reachable and operable by keyboard. **Focus states must be visible**: do not strip the default focus ring without replacing it with a clear alternative using the `posterior` token.
- **MathML.** KaTeX is configured to emit MathML alongside the visual rendering for screen readers. **Do not disable this.** Do not set the Markdown pipeline to HTML-only output.
- **Mobile.** Piece pages must be readable on mobile even when the interactive itself is desktop-only. If a piece requires a desktop browser (WebGPU, high memory, large canvas), show a small notice above the canvas on mobile rather than letting the piece silently fail. The writeup below must remain fully readable.

---

## 11. Adding a new piece: the workflow

When the owner asks to add a new piece, the steps are, in order:

1. Create `content/pieces/[slug].md` with frontmatter and writeup skeleton (use the four-question structure from §7.1).
2. Create `components/pieces/[PieceName].vue` for the Vue mount.
3. Create `pieces/[slug]/` directory with the simulation/rendering modules.
4. Create `public/pieces/[slug]/` for preview video, still image, and any assets.
5. Embed the component in the markdown with MDC `::PieceName\n::`.
6. The home page list updates automatically via `queryCollection('pieces').order('published', 'DESC')`.
7. **Verify cleanup:** navigate to the piece, then away, then back. Memory and rAF count should be stable.

Adding a sketch is the same minus step 3 (most sketches don't need a separate simulation module). Adding a note is just step 1.

### 11.1 Definition of done for a piece

A piece is not "done" until **all** of the following are true. If shipping a piece that fails one of these, document the exception in the writeup itself.

- [ ] Frontmatter validates against the schema in §7.1.
- [ ] Writeup follows the four-question structure (what / math / why interesting / how built).
- [ ] At least two references in the `references` array, formatted per §10.1.
- [ ] `preview_image` exists at `public/pieces/[slug]/`. `preview_video` exists if the piece is animated.
- [ ] The interactive runs at a stable frame rate (target **60 fps**) on a recent laptop in current Chrome and Firefox.
- [ ] **Cleanup verified.** Navigate to the piece, away, and back **at least three times.** No memory growth, no rAF leak. Check via DevTools Performance.
- [ ] Math equations render correctly in **both** `npm run dev` and `npm run generate` output. KaTeX SSR rendering occasionally drifts from client rendering; verify both.
- [ ] `source_url` points to a public GitHub repository containing the piece's code.
- [ ] The writeup is readable on mobile even if the interactive is desktop-only. The mobile fallback notice (per §10.5) is in place if needed.

For deviations (§8.1), adapt items that don't apply (e.g. the 60 fps check does not apply to a static chart) but every other item still holds.

---

## 12. Build, dev, deploy

- `npm run dev`: local development on port 3000.
- `npm run generate`: static export to `.output/public`.
- `npm run typecheck`: strict TS check across the project.
- Deploy target is static (Cloudflare Pages or Vercel). Do not introduce runtime server requirements.

---

## 13. Decisions made during scaffolding

These were chosen during the initial scaffold and noted here for review.

- **Webfonts are self-hosted.** Fontsource packages provide local WOFF2 assets for Source Serif 4, JetBrains Mono, and Inter. Do not reintroduce a font CDN.
- **No homepage hero image.** The home page is a single-column list of pieces with thumbnails. No tagline above the fold beyond one line.
- **Footer is a single muted line.** No links, no socials, no "made with" credits.
- **Plausible is not yet wired in.** Add only if/when the owner decides analytics are wanted. Self-host preferred.
- **`compatibilityDate: '2025-01-01'`** in `nuxt.config.ts`. Bump when Nuxt recommends a newer baseline.
- **No `robots.txt` or `sitemap.xml` yet.** Add `@nuxtjs/sitemap` near launch.
- **This repo was split out of a combined monorepo on 2026-08-05.** It previously lived at the repo root alongside sibling `work/` and `journal/` projects. History for this site's files was preserved via `git subtree split`; the combined monorepo now exists only as a private backup (`aruodore-monorepo-archive`). `work/` and `journal/` continue independently in their own private repos (`aruodore-work`, `aruodore-journal`).
- **Drift detection.** Re-read this document end to end once a quarter, or when adding the fifth piece, whichever comes first. Update sections that have gone stale. The document rots if it is not maintained.

---

## 14. How to start a session in this repo

1. Read this file end to end.
2. Confirm the rules in §4 (palette), §5 (stack anti-list), §9 (code), §10 (content) before suggesting changes.
3. When the owner asks for a piece, follow §11 exactly.
4. When in doubt about a design or content question, choose the option more consistent with §1 ("Probability is not abstract: here, watch it move"). When in doubt about a feature, prefer to do less.

If a request conflicts with this file, surface the conflict explicitly: _"This is in tension with §X of CLAUDE.md, which says Y. Override?"_ Don't silently break the rules. Don't silently widen the scope.

- **Maintenance.** This document is updated by the owner. Proposed changes are made by editing this file **in the same change** as the code or content that requires the change, never as a separate cleanup pass. If a session would benefit from a rule that doesn't exist yet, propose the addition, get explicit approval, and write it into this file in the same change.
