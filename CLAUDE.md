# Repository conventions

## File and component naming

- Name every repository-owned file in lowercase kebab-case, including Vue components, composables, scripts, documentation, tests, and static assets.
- Exceptions are permitted only when required by a framework, operating system, package manager, legal convention, or development tool. Current exceptions: `CLAUDE.md` (Claude instructions), `LICENSE` (legal convention), `package.json` and `package-lock.json` (npm), `tsconfig.json` (TypeScript), `.prettierrc.json` (Prettier), Nuxt route parameters such as `[slug].vue`, dotfiles, and GitHub-required paths under `.github/`.
- Use kebab-case for component tags and MDC component names wherever the framework permits it, including Nuxt built-ins.
- Use PascalCase only for TypeScript component variables when the language or API requires it; TypeScript functions, interfaces, types, and imports follow normal TypeScript naming conventions.

## Testing and definition of done

- Every production behavior and moving part requires proportionate automated coverage: unit tests for pure logic, component tests for Vue behavior, integration tests for module boundaries, end-to-end tests for critical journeys, deterministic visual tests for important states, accessibility tests for semantic UI, and measurable budgets for performance-sensitive behavior.
- Every bug fix includes a regression test that fails before the fix.
- Tests must contain meaningful assertions, surface unexpected errors, and may not be disabled with `.only`, `.skip`, or equivalent committed focus controls.
- Prefer observable behavior over implementation details. Mock system boundaries, not the behavior under test.
- Coverage is a backstop rather than evidence by itself. The repository ratchet is 90% lines/statements, 85% functions, and 80% branches; critical small state machines require complete meaningful branch coverage.
- Production work is complete only when `npm run verify` passes. Changes affecting browser behavior also require the relevant Playwright, accessibility, visual, and performance suites.

## Substantial 3D interactives

Every substantial 3D interactive must provide:

- A full-screen workspace that preserves the live canvas and simulation state.
- An accessible, explicit exit action and support for Escape.
- A fixed-viewport fallback when native element full screen is unavailable.
- Mobile controls appropriate to the interaction, with safe-area spacing and 44px minimum touch targets.
- Visible interaction guidance for orbit, zoom, reset, and exiting full screen.
