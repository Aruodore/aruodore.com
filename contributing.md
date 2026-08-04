# Contributing

## Required workflow

1. Use lowercase kebab-case filenames unless an exception is listed in `CLAUDE.md`.
2. Add the proportionate test layer with every behavior change and a regression test with every bug fix.
3. Run `npm run verify` before requesting review.
4. Run browser, accessibility, visual, and Lighthouse suites when UI or runtime behavior changes.

Required branch checks are `quality`, `browser`, `codeql`, and `lighthouse`. Pull requests must not merge with unresolved high/critical production dependency findings, accessibility regressions, browser failures, or unexplained performance-budget changes.

Dependency alerts are triaged by reachability and production impact. Accepted risk must record the package, advisory, affected path, compensating control, owner, and review date. Never weaken a test or budget only to make CI green.

Performance-budget changes require before/after measurements and a written reason. Visual snapshots require human review of the rendered diff.

Definition of done: relevant behavior is tested, documentation is current, cleanup paths are verified, generated output passes production audits, and all applicable CI checks pass.
