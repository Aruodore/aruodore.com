# Security policy

Report suspected vulnerabilities privately to lucasaruodore@gmail.com. Do not include secrets or exploit payloads in public issues.

`npm run audit:dependencies` fails on high or critical advisories reachable from the production dependency tree. Development-only findings are reported but do not block deployment unless they affect CI integrity or process untrusted input.

As of 2026-08-03, npm reports advisories in `tmp` and `uuid` through the development-only Lighthouse CI toolchain. They do not ship in the generated site and Lighthouse receives only repository-owned URLs/configuration in CI. The upstream-compatible fix proposed by npm is a destructive downgrade of Lighthouse CI, so this risk is temporarily accepted and must be reviewed with dependency updates.
