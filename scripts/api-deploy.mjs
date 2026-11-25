import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLogger } from './logger.mjs'

const log = createLogger('ORB API DEPLOY')

const host = 'api.orb.migos.club'
const workerKeys = [
  'CF_ACCESS_AUD',
  'CF_ACCESS_TEAM_DOMAIN',
  'ORB_INGEST_TOKEN',
  'ORB_WEBHOOK_SECRET',
  'ORB_CI_READ_TOKEN',
  'ORB_CI_REPOSITORIES',
]
const required = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'CF_ACCESS_APP_ID',
  'CF_ACCESS_CLIENT_ID',
  'CF_ACCESS_CLIENT_SECRET',
  ...workerKeys,
]

async function inspectAccess() {
  const api = 'https://api.cloudflare.com/client/v4/accounts/' + process.env.CLOUDFLARE_ACCOUNT_ID

  async function get(path) {
    const response = await fetch(api + path, {
      headers: { Authorization: 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN },
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw Error(`Access preflight failed (${response.status})`)
    const payload = await response.json()
    if (!payload.success) throw Error('Access preflight returned an unsuccessful response')
    return payload.result
  }

  const path = '/access/apps/' + encodeURIComponent(process.env.CF_ACCESS_APP_ID)
  const [app, policies] = await Promise.all([get(path), get(path + '/policies')])

  if (app.domain !== host || app.aud !== process.env.CF_ACCESS_AUD || app.type !== 'self_hosted') {
    throw Error('Access application does not match the Orb API hostname and audience')
  }

  const isRestricted = (policy, decision, selector) =>
    policy.decision === decision &&
    policy.include?.length > 0 &&
    policy.include.every((rule) => Object.keys(rule).length === 1 && Object.hasOwn(rule, selector))

  if (
    !policies.some((policy) => isRestricted(policy, 'allow', 'email')) ||
    !policies.some((policy) => isRestricted(policy, 'non_identity', 'service_token')) ||
    policies.some(
      (policy) =>
        !isRestricted(policy, 'allow', 'email') &&
        !isRestricted(policy, 'non_identity', 'service_token') &&
        policy.decision !== 'deny',
    )
  ) {
    throw Error('Orb Access requires explicit operator emails and a service-token policy for the smoke test')
  }
}

async function smoke(ctx) {
  const url = 'https://' + host + '/v1/health'

  for (let attempt = 0; attempt < 12; attempt++) {
    ctx.update(`tentativa ${attempt + 1}/12`)

    const anonymous = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(6000) }).catch(() => null)
    if (anonymous?.ok) throw Error('Orb API unexpectedly allows anonymous access')

    const authenticated = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
      headers: {
        'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID,
        'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET,
      },
    }).catch(() => null)

    if (authenticated?.ok && anonymous && [302, 401, 403].includes(anonymous.status)) {
      const result = await authenticated.json().catch(() => null)
      if (result?.status === 'ok' && result.service === 'orb-api') {
        return
      }
    }

    await authenticated?.body?.cancel().catch(() => {})
    await anonymous?.body?.cancel().catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }

  throw Error('Protected Orb health check did not pass')
}

function runWrangler(...args) {
  try {
    execFileSync('pnpm', ['--filter', '@orb/api', 'exec', 'wrangler', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    const output = [err.stderr?.toString(), err.stdout?.toString()].filter(Boolean).join('\n').trim()
    const error = new Error(`Wrangler command failed: wrangler ${args.join(' ')}`)
    error.stderr = output
    throw error
  }
}

async function deploy() {
  await log.step('Validate environment variables', () => {
    log.requireEnv(required)
  })

  await log.step('Inspect Cloudflare Access policies', () => inspectAccess())

  const temporary = mkdtempSync(join(tmpdir(), 'orb-deploy-'))
  try {
    const secrets = join(temporary, 'secrets.json')
    writeFileSync(
      secrets,
      JSON.stringify(Object.fromEntries(workerKeys.map((key) => [key, process.env[key]]))),
      { mode: 0o600 },
    )

    await log.step('Apply remote D1 migrations (orb-events)', () => {
      runWrangler('d1', 'migrations', 'apply', 'orb-events', '--remote')
    })

    await log.step('Deploy Worker & sync secrets', () => {
      runWrangler('deploy', '--secrets-file', secrets)
    })

    await log.step(`Verify health check (${host})`, (ctx) => smoke(ctx))

    log.summary()
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}

deploy().catch((error) => {
  log.fail(error)
})
