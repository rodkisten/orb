import { GitHubGateway, gatewayMetrics } from './github-gateway'
import { Elysia, t } from 'elysia'
import { openapi } from '@elysia/openapi'
import { authorized, eventSchema } from './events'
import { handleGitHubWebhook } from './github-webhook'
import { accessIdentity } from './access-auth'
import { readPrFailure } from './github-pr-ci'
import { ciPage } from './github-pr-ci-page'
import { readStepLog } from './github-ci-log'
import { markReceived, markQueued, persistEvent, recoverOutbox } from './storage'

type Bindings = {
  ORB_INGEST_TOKEN?: string
  GITHUB_WEBHOOK_SECRET?: string
  GITHUB_APP_ID?: string
  GITHUB_APP_PRIVATE_KEY?: string
  GITHUB_APP_INSTALLATION_ID?: string
  GITHUB_CI_READ_TOKEN?: string
  GITHUB_CI_REPOSITORIES?: string
  CF_ACCESS_TEAM_DOMAIN?: string
  CF_ACCESS_AUD?: string
  ORB_DB: D1Database
  ORB_EVENTS: Queue<{ eventId: string }>
}

function createApp(env: Bindings) {
  return new Elysia({ prefix: '/v1' })
    .use(openapi({
      path: '/openapi',
      documentation: {
        info: { title: 'orb API', version: '0.2.0', description: 'Event ingestion and automation platform' },
        tags: [
          { name: 'System', description: 'Service status' },
          { name: 'Events', description: 'Authenticated event ingestion' },
        ],
      },
    }))
    .get('/github/gateway/metrics',async ({request,set})=>{if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}set.headers['cache-control']='no-store';return gatewayMetrics()})
    .get('/actions/versions',async ({query,request,set})=>{if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}try{return await (await GitHubGateway.create(env.ORB_DB,env)).versions(query.owner,query.repo)}catch{set.status=502;return {error:'Version lookup failed'}}},{query:t.Object({owner:t.String({pattern:'^[A-Za-z0-9-]{1,39}, async ({query,request,set})=>{if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}try{return await (await GitHubGateway.create(env.ORB_DB,env)).search(query.q)}catch{set.status=502;return {error:'GitHub search failed'}}},{query:t.Object({q:t.String({minLength:2,maxLength:100})})})
    .get('/actions/resolve', async ({query,request,set})=>{if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}try{return await (await GitHubGateway.create(env.ORB_DB,env)).resolve(query.uses)}catch{set.status=502;return {error:'Action resolution failed'}}},{query:t.Object({uses:t.String({minLength:3,maxLength:250})})})
    .get('/health', () => ({
      status: 'ok' as const,
      service: 'orb-api' as const,
      version: '0.2.0',
    }), { detail: { tags: ['System'], summary: 'Health check' } })
    .get('/meta', () => ({
      name: 'orb',
      apiVersion: 'v1',
      capabilities: ['events', 'connectors', 'automation'],
    }), { detail: { tags: ['System'], summary: 'API capabilities' } })
    .get('/github/:owner/:repo/pulls/:number/ci', async ({ params, request, set }) => {
      const { owner, repo, number } = params
      const url = new URL(request.url)
      const wantsPage = url.searchParams.get('view') === 'page'
      const wantsLog = url.searchParams.get('log') === '1'
      const label = `${owner}/${repo} #${number}`
      const respond = (body: Parameters<typeof ciPage>[1], status = 200) => {
        if (wantsPage) return ciPage(label, body, status)
        set.status = status
        return body
      }
      set.headers['cache-control'] = 'no-store'
      set.headers.vary = 'Origin'
      if (request.headers.get('origin') === 'https://github.com') {
        set.headers['access-control-allow-origin'] = 'https://github.com'
        set.headers['access-control-allow-credentials'] = 'true'
      }
      if (!(await accessIdentity(request, env))) {
        return respond({ error: 'Sessão do Orb necessária.' }, 401)
      }
      const allowlist = env.GITHUB_CI_REPOSITORIES?.toLowerCase().split(',').map(value => value.trim())
      if (!allowlist?.includes(`${owner}/${repo}`.toLowerCase())) {
        return respond({ error: 'Repositório indisponível para este conector.' }, 404)
      }
      if (!env.GITHUB_CI_READ_TOKEN) {
        return respond({ error: 'Conector de CI do GitHub ainda não configurado.' }, 503)
      }
      const cacheKey = url
      cacheKey.search = ''
      try {
        if (wantsLog) {
          // Recheck the latest run before retrieving privileged log content.
          const status = await readPrFailure(owner, repo, number, env.GITHUB_CI_READ_TOKEN)
          const excerpt = status.failure
            ? await readStepLog(owner, repo, status.failure, env.GITHUB_CI_READ_TOKEN).catch(() => null)
            : null
          return respond({ ...status, excerpt })
        }
        const edgeCache = await caches.open('orb-github-pr-ci-v2')
        const cached = await edgeCache.match(cacheKey.href)
        if (cached) return respond(await cached.json<Awaited<ReturnType<typeof readPrFailure>>>())
        const status = await readPrFailure(owner, repo, number, env.GITHUB_CI_READ_TOKEN)
        await edgeCache.put(cacheKey.href, Response.json(status, {
          headers: { 'Cache-Control': 'max-age=15' },
        }))
        return respond(status)
      } catch {
        return respond({ error: 'Não foi possível consultar o CI no GitHub.' }, 502)
      }
    }, {
      params: t.Object({
        owner: t.String({ pattern: '^[A-Za-z0-9-]{1,39}$' }),
        repo: t.String({ pattern: '^[A-Za-z0-9_.-]{1,100}$' }),
        number: t.Numeric({ minimum: 1, maximum: 2147483647, multipleOf: 1 }),
      }),
      detail: { tags: ['System'], summary: 'Inspect the latest workflow failure for a pull request' },
    })
    .post('/events/validate', ({ body }) => ({ valid: true as const, event: body }), {
      body: eventSchema,
      detail: { tags: ['Events'], summary: 'Validate an event without persisting it' },
    })
    .post('/events', async ({ body, request, set }) => {
      if (!authorized(request.headers.get('authorization'), env.ORB_INGEST_TOKEN ?? '')) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      const { record, created } = await persistEvent(env.ORB_DB, body)
      if (record.status === 'pending') {
        try {
          await env.ORB_EVENTS.send({ eventId: record.id })
          await markQueued(env.ORB_DB, record.id)
        } catch {
          // Durable D1 record remains pending for a future recovery sweep.
          set.status = 503
          return { error: 'Queue unavailable; event retained for recovery', id: record.id }
        }
      }
      set.status = created ? 202 : 200
      return { id: record.id, created, status: record.status === 'pending' ? 'queued' : record.status }
    }, {
      body: eventSchema,
      detail: { tags: ['Events'], summary: 'Ingest an event idempotently' },
    })
    .get('/events', async ({ query, request, set }) => {
      if (!(await accessIdentity(request, env))) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      const clauses: string[] = []
      const values: string[] = []
      if (query.source) {
        clauses.push('source = ?')
        values.push(query.source)
      }
      if (query.status) {
        clauses.push('status = ?')
        values.push(query.status)
      }
      if (query.type) {
        clauses.push('type = ?')
        values.push(query.type)
      }
      const order = query.sort === 'oldest' ? 'ASC' : 'DESC'
      const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''
      const limit = query.limit ?? 25
      const offset = query.offset ?? 0
      const records = await env.ORB_DB.prepare(
        `SELECT id, type, source, subject_id, occurred_at, observed_at, status, attempts
         FROM events${where} ORDER BY created_at ${order}, id ${order} LIMIT ? OFFSET ?`
      ).bind(...values, limit, offset).all()
      const total = await env.ORB_DB.prepare(
        `SELECT COUNT(*) AS total FROM events${where}`
      ).bind(...values).first<{ total: number }>()
      return { items: records.results, total: total?.total ?? 0, limit, offset }
    }, {
      query: t.Object({
        source: t.Optional(t.String({ minLength: 1 })),
        type: t.Optional(t.String({ minLength: 1 })),
        status: t.Optional(t.Union([
          t.Literal('pending'), t.Literal('queued'),
          t.Literal('processed'), t.Literal('failed'),
        ])),
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
        offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
        sort: t.Optional(t.Union([t.Literal('newest'), t.Literal('oldest')])),
      }),
      detail: { tags: ['Events'], summary: 'List events with typed filters and pagination' },
    })
    .get('/events/:id', async ({ params, request, set }) => {
      if (!(await accessIdentity(request, env))) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      const record = await env.ORB_DB.prepare(
        'SELECT id, type, source, subject_id, occurred_at, observed_at, status, attempts FROM events WHERE id = ?'
      ).bind(params.id).first()
      if (!record) {
        set.status = 404
        return { error: 'Event not found' }
      }
      return record
    }, {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['Events'], summary: 'Inspect event processing status' },
    })
}

export type OrbApi = ReturnType<typeof createApp>

export default {
  fetch(request: Request, env: Bindings) {
    if (new URL(request.url).pathname === '/v1/webhooks/github') {
      return handleGitHubWebhook(request, env)
    }
    return createApp(env).fetch(request)
  },
  async scheduled(_controller: ScheduledController, env: Bindings) {
    await env.ORB_DB.prepare('DELETE FROM github_cache WHERE expires_at <= ?').bind(Date.now()).run().catch(()=>null)
    const result = await recoverOutbox(env.ORB_DB, env.ORB_EVENTS)
    console.log(JSON.stringify({ component: 'orb.outbox', ...result }))
  },
  async queue(batch: MessageBatch<{ eventId: string }>, env: Bindings) {
    for (const message of batch.messages) {
      try {
        // Processing handlers will be registered by connector modules.
        // For now only mark processed after successful durable receipt.
        await markReceived(env.ORB_DB, message.body.eventId)
        message.ack()
      } catch {
        message.retry()
      }
    }
  },
}
}),repo:t.String({pattern:'^[A-Za-z0-9_.-]{1,100}, async ({query,request,set})=>{if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}try{return await (await GitHubGateway.create(env.ORB_DB,env)).search(query.q)}catch{set.status=502;return {error:'GitHub search failed'}}},{query:t.Object({q:t.String({minLength:2,maxLength:100})})})
    .get('/actions/resolve', async ({query,request,set})=>{if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}try{return await (await GitHubGateway.create(env.ORB_DB,env)).resolve(query.uses)}catch{set.status=502;return {error:'Action resolution failed'}}},{query:t.Object({uses:t.String({minLength:3,maxLength:250})})})
    .get('/health', () => ({
      status: 'ok' as const,
      service: 'orb-api' as const,
      version: '0.2.0',
    }), { detail: { tags: ['System'], summary: 'Health check' } })
    .get('/meta', () => ({
      name: 'orb',
      apiVersion: 'v1',
      capabilities: ['events', 'connectors', 'automation'],
    }), { detail: { tags: ['System'], summary: 'API capabilities' } })
    .get('/github/:owner/:repo/pulls/:number/ci', async ({ params, request, set }) => {
      const { owner, repo, number } = params
      const url = new URL(request.url)
      const wantsPage = url.searchParams.get('view') === 'page'
      const wantsLog = url.searchParams.get('log') === '1'
      const label = `${owner}/${repo} #${number}`
      const respond = (body: Parameters<typeof ciPage>[1], status = 200) => {
        if (wantsPage) return ciPage(label, body, status)
        set.status = status
        return body
      }
      set.headers['cache-control'] = 'no-store'
      set.headers.vary = 'Origin'
      if (request.headers.get('origin') === 'https://github.com') {
        set.headers['access-control-allow-origin'] = 'https://github.com'
        set.headers['access-control-allow-credentials'] = 'true'
      }
      if (!(await accessIdentity(request, env))) {
        return respond({ error: 'Sessão do Orb necessária.' }, 401)
      }
      const allowlist = env.GITHUB_CI_REPOSITORIES?.toLowerCase().split(',').map(value => value.trim())
      if (!allowlist?.includes(`${owner}/${repo}`.toLowerCase())) {
        return respond({ error: 'Repositório indisponível para este conector.' }, 404)
      }
      if (!env.GITHUB_CI_READ_TOKEN) {
        return respond({ error: 'Conector de CI do GitHub ainda não configurado.' }, 503)
      }
      const cacheKey = url
      cacheKey.search = ''
      try {
        if (wantsLog) {
          // Recheck the latest run before retrieving privileged log content.
          const status = await readPrFailure(owner, repo, number, env.GITHUB_CI_READ_TOKEN)
          const excerpt = status.failure
            ? await readStepLog(owner, repo, status.failure, env.GITHUB_CI_READ_TOKEN).catch(() => null)
            : null
          return respond({ ...status, excerpt })
        }
        const edgeCache = await caches.open('orb-github-pr-ci-v2')
        const cached = await edgeCache.match(cacheKey.href)
        if (cached) return respond(await cached.json<Awaited<ReturnType<typeof readPrFailure>>>())
        const status = await readPrFailure(owner, repo, number, env.GITHUB_CI_READ_TOKEN)
        await edgeCache.put(cacheKey.href, Response.json(status, {
          headers: { 'Cache-Control': 'max-age=15' },
        }))
        return respond(status)
      } catch {
        return respond({ error: 'Não foi possível consultar o CI no GitHub.' }, 502)
      }
    }, {
      params: t.Object({
        owner: t.String({ pattern: '^[A-Za-z0-9-]{1,39}$' }),
        repo: t.String({ pattern: '^[A-Za-z0-9_.-]{1,100}$' }),
        number: t.Numeric({ minimum: 1, maximum: 2147483647, multipleOf: 1 }),
      }),
      detail: { tags: ['System'], summary: 'Inspect the latest workflow failure for a pull request' },
    })
    .post('/events/validate', ({ body }) => ({ valid: true as const, event: body }), {
      body: eventSchema,
      detail: { tags: ['Events'], summary: 'Validate an event without persisting it' },
    })
    .post('/events', async ({ body, request, set }) => {
      if (!authorized(request.headers.get('authorization'), env.ORB_INGEST_TOKEN ?? '')) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      const { record, created } = await persistEvent(env.ORB_DB, body)
      if (record.status === 'pending') {
        try {
          await env.ORB_EVENTS.send({ eventId: record.id })
          await markQueued(env.ORB_DB, record.id)
        } catch {
          // Durable D1 record remains pending for a future recovery sweep.
          set.status = 503
          return { error: 'Queue unavailable; event retained for recovery', id: record.id }
        }
      }
      set.status = created ? 202 : 200
      return { id: record.id, created, status: record.status === 'pending' ? 'queued' : record.status }
    }, {
      body: eventSchema,
      detail: { tags: ['Events'], summary: 'Ingest an event idempotently' },
    })
    .get('/events', async ({ query, request, set }) => {
      if (!(await accessIdentity(request, env))) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      const clauses: string[] = []
      const values: string[] = []
      if (query.source) {
        clauses.push('source = ?')
        values.push(query.source)
      }
      if (query.status) {
        clauses.push('status = ?')
        values.push(query.status)
      }
      if (query.type) {
        clauses.push('type = ?')
        values.push(query.type)
      }
      const order = query.sort === 'oldest' ? 'ASC' : 'DESC'
      const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''
      const limit = query.limit ?? 25
      const offset = query.offset ?? 0
      const records = await env.ORB_DB.prepare(
        `SELECT id, type, source, subject_id, occurred_at, observed_at, status, attempts
         FROM events${where} ORDER BY created_at ${order}, id ${order} LIMIT ? OFFSET ?`
      ).bind(...values, limit, offset).all()
      const total = await env.ORB_DB.prepare(
        `SELECT COUNT(*) AS total FROM events${where}`
      ).bind(...values).first<{ total: number }>()
      return { items: records.results, total: total?.total ?? 0, limit, offset }
    }, {
      query: t.Object({
        source: t.Optional(t.String({ minLength: 1 })),
        type: t.Optional(t.String({ minLength: 1 })),
        status: t.Optional(t.Union([
          t.Literal('pending'), t.Literal('queued'),
          t.Literal('processed'), t.Literal('failed'),
        ])),
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
        offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
        sort: t.Optional(t.Union([t.Literal('newest'), t.Literal('oldest')])),
      }),
      detail: { tags: ['Events'], summary: 'List events with typed filters and pagination' },
    })
    .get('/events/:id', async ({ params, request, set }) => {
      if (!(await accessIdentity(request, env))) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      const record = await env.ORB_DB.prepare(
        'SELECT id, type, source, subject_id, occurred_at, observed_at, status, attempts FROM events WHERE id = ?'
      ).bind(params.id).first()
      if (!record) {
        set.status = 404
        return { error: 'Event not found' }
      }
      return record
    }, {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['Events'], summary: 'Inspect event processing status' },
    })
}

export type OrbApi = ReturnType<typeof createApp>

export default {
  fetch(request: Request, env: Bindings) {
    if (new URL(request.url).pathname === '/v1/webhooks/github') {
      return handleGitHubWebhook(request, env)
    }
    return createApp(env).fetch(request)
  },
  async scheduled(_controller: ScheduledController, env: Bindings) {
    const result = await recoverOutbox(env.ORB_DB, env.ORB_EVENTS)
    console.log(JSON.stringify({ component: 'orb.outbox', ...result }))
  },
  async queue(batch: MessageBatch<{ eventId: string }>, env: Bindings) {
    for (const message of batch.messages) {
      try {
        // Processing handlers will be registered by connector modules.
        // For now only mark processed after successful durable receipt.
        await markReceived(env.ORB_DB, message.body.eventId)
        message.ack()
      } catch {
        message.retry()
      }
    }
  },
}
})})})
    .get('/actions/search', async ({query,request,set})=>{if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}try{return await (await GitHubGateway.create(env.ORB_DB,env)).search(query.q)}catch{set.status=502;return {error:'GitHub search failed'}}},{query:t.Object({q:t.String({minLength:2,maxLength:100})})})
    .get('/actions/resolve', async ({query,request,set})=>{if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}try{return await (await GitHubGateway.create(env.ORB_DB,env)).resolve(query.uses)}catch{set.status=502;return {error:'Action resolution failed'}}},{query:t.Object({uses:t.String({minLength:3,maxLength:250})})})
    .get('/health', () => ({
      status: 'ok' as const,
      service: 'orb-api' as const,
      version: '0.2.0',
    }), { detail: { tags: ['System'], summary: 'Health check' } })
    .get('/meta', () => ({
      name: 'orb',
      apiVersion: 'v1',
      capabilities: ['events', 'connectors', 'automation'],
    }), { detail: { tags: ['System'], summary: 'API capabilities' } })
    .get('/github/:owner/:repo/pulls/:number/ci', async ({ params, request, set }) => {
      const { owner, repo, number } = params
      const url = new URL(request.url)
      const wantsPage = url.searchParams.get('view') === 'page'
      const wantsLog = url.searchParams.get('log') === '1'
      const label = `${owner}/${repo} #${number}`
      const respond = (body: Parameters<typeof ciPage>[1], status = 200) => {
        if (wantsPage) return ciPage(label, body, status)
        set.status = status
        return body
      }
      set.headers['cache-control'] = 'no-store'
      set.headers.vary = 'Origin'
      if (request.headers.get('origin') === 'https://github.com') {
        set.headers['access-control-allow-origin'] = 'https://github.com'
        set.headers['access-control-allow-credentials'] = 'true'
      }
      if (!(await accessIdentity(request, env))) {
        return respond({ error: 'Sessão do Orb necessária.' }, 401)
      }
      const allowlist = env.GITHUB_CI_REPOSITORIES?.toLowerCase().split(',').map(value => value.trim())
      if (!allowlist?.includes(`${owner}/${repo}`.toLowerCase())) {
        return respond({ error: 'Repositório indisponível para este conector.' }, 404)
      }
      if (!env.GITHUB_CI_READ_TOKEN) {
        return respond({ error: 'Conector de CI do GitHub ainda não configurado.' }, 503)
      }
      const cacheKey = url
      cacheKey.search = ''
      try {
        if (wantsLog) {
          // Recheck the latest run before retrieving privileged log content.
          const status = await readPrFailure(owner, repo, number, env.GITHUB_CI_READ_TOKEN)
          const excerpt = status.failure
            ? await readStepLog(owner, repo, status.failure, env.GITHUB_CI_READ_TOKEN).catch(() => null)
            : null
          return respond({ ...status, excerpt })
        }
        const edgeCache = await caches.open('orb-github-pr-ci-v2')
        const cached = await edgeCache.match(cacheKey.href)
        if (cached) return respond(await cached.json<Awaited<ReturnType<typeof readPrFailure>>>())
        const status = await readPrFailure(owner, repo, number, env.GITHUB_CI_READ_TOKEN)
        await edgeCache.put(cacheKey.href, Response.json(status, {
          headers: { 'Cache-Control': 'max-age=15' },
        }))
        return respond(status)
      } catch {
        return respond({ error: 'Não foi possível consultar o CI no GitHub.' }, 502)
      }
    }, {
      params: t.Object({
        owner: t.String({ pattern: '^[A-Za-z0-9-]{1,39}$' }),
        repo: t.String({ pattern: '^[A-Za-z0-9_.-]{1,100}$' }),
        number: t.Numeric({ minimum: 1, maximum: 2147483647, multipleOf: 1 }),
      }),
      detail: { tags: ['System'], summary: 'Inspect the latest workflow failure for a pull request' },
    })
    .post('/events/validate', ({ body }) => ({ valid: true as const, event: body }), {
      body: eventSchema,
      detail: { tags: ['Events'], summary: 'Validate an event without persisting it' },
    })
    .post('/events', async ({ body, request, set }) => {
      if (!authorized(request.headers.get('authorization'), env.ORB_INGEST_TOKEN ?? '')) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      const { record, created } = await persistEvent(env.ORB_DB, body)
      if (record.status === 'pending') {
        try {
          await env.ORB_EVENTS.send({ eventId: record.id })
          await markQueued(env.ORB_DB, record.id)
        } catch {
          // Durable D1 record remains pending for a future recovery sweep.
          set.status = 503
          return { error: 'Queue unavailable; event retained for recovery', id: record.id }
        }
      }
      set.status = created ? 202 : 200
      return { id: record.id, created, status: record.status === 'pending' ? 'queued' : record.status }
    }, {
      body: eventSchema,
      detail: { tags: ['Events'], summary: 'Ingest an event idempotently' },
    })
    .get('/events', async ({ query, request, set }) => {
      if (!(await accessIdentity(request, env))) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      const clauses: string[] = []
      const values: string[] = []
      if (query.source) {
        clauses.push('source = ?')
        values.push(query.source)
      }
      if (query.status) {
        clauses.push('status = ?')
        values.push(query.status)
      }
      if (query.type) {
        clauses.push('type = ?')
        values.push(query.type)
      }
      const order = query.sort === 'oldest' ? 'ASC' : 'DESC'
      const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''
      const limit = query.limit ?? 25
      const offset = query.offset ?? 0
      const records = await env.ORB_DB.prepare(
        `SELECT id, type, source, subject_id, occurred_at, observed_at, status, attempts
         FROM events${where} ORDER BY created_at ${order}, id ${order} LIMIT ? OFFSET ?`
      ).bind(...values, limit, offset).all()
      const total = await env.ORB_DB.prepare(
        `SELECT COUNT(*) AS total FROM events${where}`
      ).bind(...values).first<{ total: number }>()
      return { items: records.results, total: total?.total ?? 0, limit, offset }
    }, {
      query: t.Object({
        source: t.Optional(t.String({ minLength: 1 })),
        type: t.Optional(t.String({ minLength: 1 })),
        status: t.Optional(t.Union([
          t.Literal('pending'), t.Literal('queued'),
          t.Literal('processed'), t.Literal('failed'),
        ])),
        limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
        offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
        sort: t.Optional(t.Union([t.Literal('newest'), t.Literal('oldest')])),
      }),
      detail: { tags: ['Events'], summary: 'List events with typed filters and pagination' },
    })
    .get('/events/:id', async ({ params, request, set }) => {
      if (!(await accessIdentity(request, env))) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      const record = await env.ORB_DB.prepare(
        'SELECT id, type, source, subject_id, occurred_at, observed_at, status, attempts FROM events WHERE id = ?'
      ).bind(params.id).first()
      if (!record) {
        set.status = 404
        return { error: 'Event not found' }
      }
      return record
    }, {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['Events'], summary: 'Inspect event processing status' },
    })
}

export type OrbApi = ReturnType<typeof createApp>

export default {
  fetch(request: Request, env: Bindings) {
    if (new URL(request.url).pathname === '/v1/webhooks/github') {
      return handleGitHubWebhook(request, env)
    }
    return createApp(env).fetch(request)
  },
  async scheduled(_controller: ScheduledController, env: Bindings) {
    const result = await recoverOutbox(env.ORB_DB, env.ORB_EVENTS)
    console.log(JSON.stringify({ component: 'orb.outbox', ...result }))
  },
  async queue(batch: MessageBatch<{ eventId: string }>, env: Bindings) {
    for (const message of batch.messages) {
      try {
        // Processing handlers will be registered by connector modules.
        // For now only mark processed after successful durable receipt.
        await markReceived(env.ORB_DB, message.body.eventId)
        message.ack()
      } catch {
        message.retry()
      }
    }
  },
}
