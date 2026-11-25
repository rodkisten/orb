import type {JardimBindings} from './jardim'
import {processDelivery,replayDelivery} from './delivery'
import { GitHubGateway, gatewayMetrics } from './github-gateway'
import { Elysia, t } from 'elysia'
import { openapi } from '@elysia/openapi'
import { authorized, eventSchema } from './events'
import { handleGitHubWebhook } from './github-webhook'
import { accessIdentity } from './access-auth'
import { workflowSource, validateWorkflow } from './workflow-builder'
import { inspectWorkflow, parseWorkflow, replaceScalar } from '@orb/workflow-core'
import { repositoryRead, GatewayError } from './repository-read'
import { githubToken, githubAuthMode } from './github-auth'
import { readPrFailure } from './github-pr-ci'
import { ciPage } from './github-pr-ci-page'
import { readStepLog } from './github-ci-log'
import { markReceived, markQueued, persistEvent, recoverOutbox } from './storage'

type Bindings = JardimBindings & {
  ORB_INGEST_TOKEN?: string
  ORB_WEBHOOK_SECRET?: string
  ORB_GITHUB_APP_ID?: string
  ORB_GITHUB_APP_INSTALLATION_ID?: string
  ORB_GITHUB_APP_PRIVATE_KEY?: string
  ORB_CI_READ_TOKEN?: string
  ORB_CI_REPOSITORIES?: string
  CF_ACCESS_TEAM_DOMAIN?: string
  CF_ACCESS_AUD?: string
  ORB_DB: D1Database
  ORB_EVENTS: Queue<{ eventId: string }>
}

const repositoryParams=t.Object({owner:t.String({pattern:'^[A-Za-z0-9-]{1,39}$'}),repo:t.String({pattern:'^[A-Za-z0-9_.-]{1,100}$'})})
const paginationQuery=t.Object({page:t.Optional(t.Numeric({minimum:1,maximum:1000,multipleOf:1})),limit:t.Optional(t.Numeric({minimum:1,maximum:100,multipleOf:1}))})
function createApp(env: Bindings) {
  return new Elysia({ prefix: '/v1', aot: false })
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
    .get('/github/gateway/metrics',async ({request,set})=>{if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}set.headers['cache-control']='no-store';return {...gatewayMetrics(), authMode: githubAuthMode(env)}})
    .get('/github/repositories', async ({request,set}) => {
      if (!(await accessIdentity(request,env))) { set.status=401; return {error:'Unauthorized'} }
      set.headers['cache-control']='no-store'
      if (githubAuthMode(env)==='unconfigured') {set.status=503;return {error:'GitHub credentials unavailable'}}
      try {return await (await GitHubGateway.create(env.ORB_DB,env)).repositories((env.ORB_CI_REPOSITORIES??'').split(','))}
      catch {set.status=502;return {error:'Repository discovery failed'}}
    }, {detail:{tags:['System'],summary:'Discover accessible configured repositories'}})
    .get('/github/:owner/:repo/files', async ({params,query,request,set})=>{
      set.headers['cache-control']='no-store'
      if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}
      try{return await repositoryRead(env,params.owner,params.repo,'contents',query.page??1,query.limit??30,{path:query.path,ref:query.ref})}
      catch(error){set.status=error instanceof GatewayError?error.status:502;return {error:error instanceof GatewayError?error.message:'GitHub request failed'}}
    },{params:repositoryParams,query:t.Object({page:t.Optional(t.Numeric({minimum:1,maximum:1000})),limit:t.Optional(t.Numeric({minimum:1,maximum:100})),path:t.Optional(t.String({maxLength:1024})),ref:t.Optional(t.String({maxLength:256}))}),detail:{tags:['GitHub']}})
    .get('/github/:owner/:repo/branches', async ({params,query,request,set})=>{
      set.headers['cache-control']='no-store'
      if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}
      try{return await repositoryRead(env,params.owner,params.repo,'branches',query.page??1,query.limit??30)}
      catch(error){set.status=error instanceof GatewayError?error.status:502;return {error:error instanceof GatewayError?error.message:'GitHub request failed'}}
    },{params:repositoryParams,query:paginationQuery,detail:{tags:['GitHub']}})
    .get('/github/:owner/:repo/pulls', async ({params,query,request,set})=>{
      set.headers['cache-control']='no-store'
      if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}
      try{return await repositoryRead(env,params.owner,params.repo,'pulls',query.page??1,query.limit??30)}
      catch(error){set.status=error instanceof GatewayError?error.status:502;return {error:error instanceof GatewayError?error.message:'GitHub request failed'}}
    },{params:repositoryParams,query:paginationQuery,detail:{tags:['GitHub']}})
    .get('/github/:owner/:repo/commits', async ({params,query,request,set})=>{
      set.headers['cache-control']='no-store'
      if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}
      try{return await repositoryRead(env,params.owner,params.repo,'commits',query.page??1,query.limit??30)}
      catch(error){set.status=error instanceof GatewayError?error.status:502;return {error:error instanceof GatewayError?error.message:'GitHub request failed'}}
    },{params:repositoryParams,query:paginationQuery,detail:{tags:['GitHub']}})
    .get('/github/:owner/:repo/actions/workflows', async ({params,query,request,set})=>{
      set.headers['cache-control']='no-store'
      if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}
      try{return await repositoryRead(env,params.owner,params.repo,'actions/workflows',query.page??1,query.limit??30)}
      catch(error){set.status=error instanceof GatewayError?error.status:502;return {error:error instanceof GatewayError?error.message:'GitHub request failed'}}
    },{params:repositoryParams,query:paginationQuery,detail:{tags:['GitHub']}})
    .get('/github/:owner/:repo/actions/runs', async ({params,query,request,set})=>{
      set.headers['cache-control']='no-store'
      if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}
      try{return await repositoryRead(env,params.owner,params.repo,'actions/runs',query.page??1,query.limit??30)}
      catch(error){set.status=error instanceof GatewayError?error.status:502;return {error:error instanceof GatewayError?error.message:'GitHub request failed'}}
    },{params:repositoryParams,query:paginationQuery,detail:{tags:['GitHub']}})
    .get('/github/:owner/:repo/workflow-source',async ({params,query,request,set})=>{
      set.headers['cache-control']='no-store'
      if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}
      try{return await workflowSource(env,params.owner,params.repo,query.path,query.ref)}
      catch(error){set.status=error instanceof GatewayError?error.status:502;return {error:error instanceof GatewayError?error.message:'Workflow source lookup failed'}}
    },{params:repositoryParams,query:t.Object({path:t.String({pattern:'^\\.github/workflows/[A-Za-z0-9_.-]+\\.ya?ml$',maxLength:255}),ref:t.Optional(t.String({minLength:1,maxLength:255}))}),detail:{tags:['Workflow Builder']}})
    .post('/workflows/validate',async ({body,request,set})=>{
      if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}
      return validateWorkflow(body.yaml)
    },{body:t.Object({yaml:t.String({maxLength:262144})}),detail:{tags:['Workflow Builder']}})
    .post('/workflows/parse',async ({body,request,set})=>{
      if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}
      return parseWorkflow(body.yaml)
    },{body:t.Object({yaml:t.String({maxLength:262144})}),detail:{tags:['Workflow Builder']}})
    .post('/workflows/transform',async ({body,request,set})=>{
      if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}
      try{return replaceScalar(body.yaml,body.path,body.value)}
      catch{set.status=422;return {error:'Unsupported scalar transformation'}}
    },{body:t.Object({yaml:t.String({maxLength:262144}),path:t.Array(t.Union([t.String({maxLength:255}),t.Integer({minimum:0})]),{minItems:1,maxItems:100}),value:t.String({maxLength:65536})}),detail:{tags:['Workflow Builder']}})
    .post('/workflows/inspect',async ({body,request,set})=>{
      if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}
      return inspectWorkflow(body.yaml)
    },{body:t.Object({yaml:t.String({maxLength:262144})}),detail:{tags:['Workflow Builder']}})
    .get('/actions/versions', async ({query,request,set}) => {
      if (!(await accessIdentity(request,env))) { set.status=401; return {error:'Unauthorized'} }
      try { return await (await GitHubGateway.create(env.ORB_DB,env)).versions(query.owner,query.repo) }
      catch { set.status=502; return {error:'Version lookup failed'} }
    }, {query:t.Object({owner:t.String({pattern:'^[A-Za-z0-9-]{1,39}$'}),repo:t.String({pattern:'^[A-Za-z0-9_.-]{1,100}$'})})})
    .get('/actions/search', async ({query,request,set}) => {
      if (!(await accessIdentity(request,env))) { set.status=401; return {error:'Unauthorized'} }
      try { return await (await GitHubGateway.create(env.ORB_DB,env)).search(query.q) }
      catch { set.status=502; return {error:'GitHub search failed'} }
    }, {query:t.Object({q:t.String({minLength:2,maxLength:100})})})
    .get('/actions/resolve', async ({query,request,set}) => {
      if (!(await accessIdentity(request,env))) { set.status=401; return {error:'Unauthorized'} }
      try { return await (await GitHubGateway.create(env.ORB_DB,env)).resolve(query.uses) }
      catch { set.status=502; return {error:'Action resolution failed'} }
    }, {query:t.Object({uses:t.String({minLength:3,maxLength:250})})})
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
      const allowlist = env.ORB_CI_REPOSITORIES?.toLowerCase().split(',').map(value => value.trim())
      if (!allowlist?.includes(`${owner}/${repo}`.toLowerCase())) {
        return respond({ error: 'Repositório indisponível para este conector.' }, 404)
      }
      const token = await githubToken(env).catch(() => null)
      if (!token) {
        return respond({ error: 'Conector de CI do GitHub ainda não configurado.' }, 503)
      }
      const cacheKey = url
      cacheKey.search = ''
      try {
        if (wantsLog) {
          // Recheck the latest run before retrieving privileged log content.
          const status = await readPrFailure(owner, repo, number, token)
          const excerpt = status.failure
            ? await readStepLog(owner, repo, status.failure, token).catch(() => null)
            : null
          return respond({ ...status, excerpt })
        }
        const edgeCache = await caches.open('orb-github-pr-ci-v2')
        const cached = await edgeCache.match(cacheKey.href)
        if (cached) return respond(await cached.json<Awaited<ReturnType<typeof readPrFailure>>>())
        const status = await readPrFailure(owner, repo, number, token)
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
    .get('/connectors/jardim/deliveries',async ({request,set})=>{
      if(!(await accessIdentity(request,env))){set.status=401;return {error:'Unauthorized'}}
      const rows=await env.ORB_DB.prepare("SELECT event_id,state,attempts,last_error,next_attempt_at,updated_at FROM connector_deliveries ORDER BY updated_at DESC LIMIT 100").all()
      return {enabled:env.JARDIM_CAPTURE_ENABLED==='true',items:rows.results}
    })
    .post('/connectors/jardim/deliveries/:id/replay',async ({request,params,set})=>{
      if(!(await accessIdentity(request,env))||request.headers.get('origin')!==new URL(request.url).origin){set.status=403;return {error:'Forbidden'}}
      await replayDelivery(env.ORB_DB,params.id)
      return {accepted:true}
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
  async fetch(request: Request, env: Bindings) {
    try {
    if (new URL(request.url).pathname === '/v1/webhooks/github') {
      return handleGitHubWebhook(request, env)
    }
    return await createApp(env).fetch(request)
    } catch (error) {
      console.error('orb.fetch failed', error instanceof Error ? error.stack : 'Unknown error')
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
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
        const state=await env.ORB_DB.prepare('SELECT status FROM events WHERE id=?').bind(message.body.eventId).first<{status:string}>()
        if(state?.status==='failed'){message.ack();continue}
        const delivery=await env.ORB_DB.prepare('SELECT state FROM connector_deliveries WHERE event_id=?').bind(message.body.eventId).first<{state:string}>()
        if(delivery?.state!=='delivered')await processDelivery(env.ORB_DB,message.body.eventId,env)
        await markReceived(env.ORB_DB, message.body.eventId)
        message.ack()
      } catch {
        message.retry({delaySeconds:60})
      }
    }
  },
}
