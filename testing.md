# Testing

Use Node 22 or newer and install the locked dependency graph with `npm ci`.

## Test layers

- `npm run test:unit` covers deterministic mathematics, formatting, citations, and composable state machines.
- `npm run test:component` mounts Vue components with WebGL and browser boundaries mocked.
- `npm run test:integration` verifies content-to-component registration and cross-file contracts.
- `npm run test:coverage` runs all Vitest suites and enforces the coverage ratchet.
- `npm run test:e2e` generates and serves the production site, then runs Chromium, Firefox, and WebKit journeys.
- `npm run test:accessibility` runs axe and explicit semantic assertions.
- `npm run test:visual` runs deterministic reduced-motion snapshots. Update intentional baselines with `npx playwright test --grep @visual --update-snapshots`, inspect every diff, and commit only reviewed images.
- `npm run test:performance` runs three Lighthouse samples per representative page and enforces metric and transfer budgets.

Failed Playwright traces, screenshots, and videos are written to `test-results/`; open traces with `npx playwright show-trace <trace.zip>`.

## Coverage and manual checks

Coverage must remain at or above 90% lines/statements, 85% functions, and 80% branches. A high percentage never replaces meaningful behavioral assertions. Axe cannot prove logical focus order, touch target geometry, motion comfort, WebGL correctness, or screen-reader usability; Playwright assertions cover automatable portions and significant interaction changes still receive manual keyboard, mobile, and screen-reader review.
