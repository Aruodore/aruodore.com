import { execFileSync, spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import Database from 'better-sqlite3'
import { inspectProduction, loadPiece, validatePiece } from './lib/social-release.mjs'

const args = process.argv.slice(2)
const publish = args.includes('--publish')
const checkOnly = args.includes('--check')
const slug = args.find((argument) => !argument.startsWith('--'))
if (!slug || publish === checkOnly) {
  console.error('Usage: npm run social:check -- <slug> | npm run social:publish -- <slug>')
  process.exit(2)
}

const piece = await loadPiece(slug)
const platforms = validatePiece(piece)

async function waitForProduction() {
  const deadline = Date.now() + (publish ? 10 * 60_000 : 1)
  let lastError
  do {
    try {
      const results = []
      for (const platform of platforms) results.push(await inspectProduction(piece, platform))
      return results
    } catch (error) {
      lastError = error
      if (!publish || Date.now() >= deadline) break
      console.log(`Production is not ready yet: ${error.message}. Checking again in 10 seconds.`)
      await delay(10_000)
    }
  } while (Date.now() < deadline)
  throw lastError
}

function runGit(...command) {
  return execFileSync('git', command, { encoding: 'utf8' }).trim()
}

function verifyReleaseState() {
  if (runGit('status', '--porcelain')) throw new Error('working tree is not clean; commit the social copy first')
  if (runGit('branch', '--show-current') !== 'main') throw new Error('social publishing only runs from main')
  const head = runGit('rev-parse', 'HEAD')
  if (runGit('rev-parse', 'origin/main') !== head) throw new Error('current commit has not been pushed to origin/main')

  const repository = new URL(
    runGit('remote', 'get-url', 'origin')
      .replace(/^git@github\.com:/, 'https://github.com/')
      .replace(/\.git$/, ''),
  ).pathname.slice(1)
  const raw = execFileSync('gh', ['api', `repos/${repository}/commits/${head}/check-runs`], { encoding: 'utf8' })
  const checks = JSON.parse(raw).check_runs ?? []
  if (!checks.length) throw new Error('GitHub has not reported CI checks for this commit')
  const unhealthy = checks.filter(
    (check) => check.status !== 'completed' || !['success', 'neutral', 'skipped'].includes(check.conclusion),
  )
  if (unhealthy.length)
    throw new Error(
      `CI is not green: ${unhealthy.map((check) => `${check.name}=${check.status}/${check.conclusion ?? 'pending'}`).join(', ')}`,
    )
}

function postdeckConfiguration() {
  const org = process.env.POSTDECK_ORG ?? 'aruo'
  const account = process.env.POSTDECK_ACCOUNT ?? 'aruodore'
  const root = process.env.POSTDECK_HOME
  const dbPath =
    process.env.POSTDECK_DB ?? (root ? join(root, 'postdeck.db') : join(homedir(), '.local/share/postdeck/postdeck.db'))
  const bin = process.env.POSTDECK_BIN ?? join(homedir(), 'manager/.venv/bin/postdeck')
  return { org, account, dbPath, bin }
}

function preparePostdeck(pieceDetails, shouldWrite) {
  const config = postdeckConfiguration()
  const db = new Database(config.dbPath, { readonly: !shouldWrite, fileMustExist: true })
  db.pragma('foreign_keys = ON')
  const org = db.prepare('SELECT * FROM orgs WHERE slug = ? AND archived_at IS NULL').get(config.org)
  if (!org) throw new Error(`Postdeck org ${JSON.stringify(config.org)} does not exist`)
  const account = db
    .prepare('SELECT * FROM accounts WHERE org_id = ? AND slug = ? AND archived_at IS NULL')
    .get(org.id, config.account)
  if (!account)
    throw new Error(
      `Postdeck account ${config.org}/${config.account} does not exist. Set POSTDECK_ACCOUNT or add it in Postdeck.`,
    )

  const channels = new Map()
  for (const platform of platforms) {
    const channel = db
      .prepare('SELECT * FROM channels WHERE account_id = ? AND platform = ? AND archived_at IS NULL')
      .get(account.id, platform)
    if (!channel) throw new Error(`Postdeck has no ${platform} channel for ${config.org}/${config.account}`)
    if (channel.status !== 'active')
      throw new Error(`Postdeck ${platform} channel ${channel.id} is ${channel.status}, not active`)
    if (platform === 'x' && channel.mode !== 'api')
      throw new Error(
        `Postdeck X channel ${channel.id} must be connected and set to api mode (currently ${channel.mode})`,
      )
    if (platform === 'linkedin' && channel.mode !== 'manual')
      throw new Error('Postdeck does not have a LinkedIn API publisher yet; keep this channel in manual mode')
    channels.set(platform, channel)
  }

  const sourceRef = `aruodore.com:piece:${pieceDetails.slug}:v${pieceDetails.version}`
  let post = db.prepare('SELECT * FROM posts WHERE org_id = ? AND source_ref = ?').get(org.id, sourceRef)
  const targetRows = () =>
    db
      .prepare(
        `
    SELECT t.*, c.platform FROM post_targets t
    JOIN channels c ON c.id = t.channel_id WHERE t.post_id = ? ORDER BY t.id
  `,
      )
      .all(post.id)

  if (!shouldWrite) {
    const existing = post ? targetRows() : []
    db.close()
    return { config, sourceRef, existing, created: false }
  }

  let created = false
  db.transaction(() => {
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00')
    if (!post) {
      const inserted = db
        .prepare(
          `
        INSERT INTO posts (org_id, account_id, group_slug, title, caption, source_ref, status, created_at, updated_at)
        VALUES (?, ?, 'aruodore.com', ?, ?, ?, 'ready', ?, ?)
      `,
        )
        .run(
          org.id,
          account.id,
          pieceDetails.title,
          pieceDetails.social.x ?? Object.values(pieceDetails.social)[0],
          sourceRef,
          now,
          now,
        )
      post = { id: Number(inserted.lastInsertRowid) }
      created = true
    }

    for (const [platform, caption] of Object.entries(pieceDetails.social)) {
      const channel = channels.get(platform)
      const existing = db
        .prepare('SELECT * FROM post_targets WHERE post_id = ? AND channel_id = ?')
        .get(post.id, channel.id)
      if (!existing) {
        db.prepare(
          `
          INSERT INTO post_targets (post_id, channel_id, caption, status, created_at, updated_at)
          VALUES (?, ?, ?, 'draft', ?, ?)
        `,
        ).run(post.id, channel.id, caption, now, now)
      } else if (existing.status !== 'published' && existing.status !== 'needs_action') {
        db.prepare('UPDATE post_targets SET caption = ?, updated_at = ? WHERE id = ?').run(caption, now, existing.id)
      }
    }
  })()

  const existing = targetRows()
  db.close()
  return { config, sourceRef, existing, created }
}

function readTargetStatus(dbPath, targetId) {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    return db.prepare('SELECT status, last_error, remote_url FROM post_targets WHERE id = ?').get(targetId)
  } finally {
    db.close()
  }
}

try {
  const production = await waitForProduction()
  console.log(`Production ready: ${piece.canonicalUrl}`)
  for (const result of production) console.log(`  ${result.userAgent}: ${result.image} (${result.bytes} bytes)`)

  if (checkOnly) {
    console.log(`Social copy ready for: ${platforms.join(', ')}`)
    process.exit(0)
  }

  verifyReleaseState()
  const prepared = preparePostdeck(piece, true)
  console.log(`${prepared.created ? 'Created' : 'Found'} Postdeck item ${prepared.sourceRef}`)

  for (const target of prepared.existing) {
    if (target.status === 'published' || target.status === 'needs_action') {
      console.log(`  ${target.platform} target ${target.id}: already ${target.status}`)
      continue
    }
    const result = spawnSync(
      prepared.config.bin,
      ['--org', prepared.config.org, 'publish', '--force', String(target.id)],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    if (result.stdout.trim()) console.log(result.stdout.trim())
    if (result.status !== 0) throw new Error(result.stderr.trim() || `Postdeck exited ${result.status}`)
    const final = readTargetStatus(prepared.config.dbPath, target.id)
    const accepted = target.platform === 'linkedin' ? ['needs_action', 'published'] : ['published']
    if (!final || !accepted.includes(final.status))
      throw new Error(
        `Postdeck ${target.platform} target ${target.id} ended as ${final?.status ?? 'missing'}: ${final?.last_error ?? 'no error reported'}`,
      )
    console.log(
      `  ${target.platform} target ${target.id}: ${final.status}${final.remote_url ? ` (${final.remote_url})` : ''}`,
    )
  }
} catch (error) {
  console.error(`Social release stopped: ${error.message}`)
  process.exit(1)
}
