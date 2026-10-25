import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const unitDirectory = join(homedir(), '.config/systemd/user')
const servicePath = join(unitDirectory, 'aruodore-social-publisher.service')
const timerPath = join(unitDirectory, 'aruodore-social-publisher.timer')
const escapedRoot = process.cwd().replaceAll('\\', '\\\\').replaceAll('"', '\\"')
const escapedNode = process.execPath.replaceAll('\\', '\\\\').replaceAll('"', '\\"')

const service = `[Unit]
Description=Publish verified Aruodore releases through Postdeck
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${escapedRoot}
ExecStart=${escapedNode} ${escapedRoot}/scripts/publish-ready-pieces.mjs
`

const timer = `[Unit]
Description=Check for verified Aruodore releases ready for social publishing

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
`

await mkdir(unitDirectory, { recursive: true })
await writeFile(servicePath, service, { mode: 0o644 })
await writeFile(timerPath, timer, { mode: 0o644 })
execFileSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'inherit' })
execFileSync('systemctl', ['--user', 'enable', '--now', 'aruodore-social-publisher.timer'], { stdio: 'inherit' })
console.log(`Installed ${timerPath}`)
