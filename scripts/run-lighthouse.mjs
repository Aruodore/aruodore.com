import { spawnSync } from 'node:child_process'
import { chromium } from '@playwright/test'

const result = spawnSync('lhci', ['autorun'], {
  cwd: process.cwd(),
  env: { ...process.env, LHCI_CHROME_PATH: chromium.executablePath() },
  encoding: 'utf8',
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
