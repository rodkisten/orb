import { Elysia, t } from 'elysia'
import { openapi } from '@elysia/openapi'
import { authorized, eventSchema } from './events'
import { markReceived, markQueued, persistEvent, recoverOutbox } from './storage'

type Bindings = {
  ORB_INGEST_TOKEN: string
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
    .post('/events/validate', ({ body }) => ({ valid: true as const, event: body }), {
      body: eventSchema,
      detail: { tags: ['Events'], summary: 'Validate an event without persisting it' },
    })
    .post('/events', async ({ body, request, set }) => {
      if (!authorized(request.headers.get('authorization'), env.ORB_INGEST_TOKEN)) {
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
      if (!authorized(request.headers.get('authorization'), env.ORB_INGEST_TOKEN)) {
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
      if (!authorized(request.headers.get('authorization'), env.ORB_INGEST_TOKEN)) {
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
