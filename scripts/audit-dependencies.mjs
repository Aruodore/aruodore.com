import { spawnSync } from 'node:child_process'

function run(args) {
  return spawnSync('npm', args, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
}

const treeResult = run(['ls', '--omit=dev', '--all', '--json'])
if (!treeResult.stdout) {
  console.error(treeResult.stderr || 'Unable to inspect the production dependency tree.')
  process.exit(1)
}

const productionPackages = new Set()
function collect(dependencies = {}) {
  for (const [name, dependency] of Object.entries(dependencies)) {
    productionPackages.add(name)
    collect(dependency.dependencies)
  }
}
collect(JSON.parse(treeResult.stdout).dependencies)

const auditResult = run(['audit', '--json'])
if (!auditResult.stdout) {
  console.error(auditResult.stderr || 'The npm advisory service did not return a report.')
  process.exit(1)
}

const report = JSON.parse(auditResult.stdout)
const actionable = Object.entries(report.vulnerabilities ?? {}).filter(
  ([name, finding]) => productionPackages.has(name) && ['high', 'critical'].includes(finding.severity),
)
const nonProduction = Object.entries(report.vulnerabilities ?? {}).filter(([name]) => !productionPackages.has(name))

if (actionable.length) {
  console.error(
    `Actionable production advisories:\n${actionable.map(([name, finding]) => `- ${name}: ${finding.severity}`).join('\n')}`,
  )
  process.exit(1)
}

console.log(
  `Production dependency audit passed. ${nonProduction.length} development-only advisory entries are tracked but do not ship.`,
)
