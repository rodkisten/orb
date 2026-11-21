import { Elysia, t } from 'elysia'
import { openapi } from '@elysia/openapi'

type Bindings = {
  ORB_ENV?: string
}

const app = new Elysia({ prefix: '/v1' })
  .use(openapi({
    path: '/openapi',
    documentation: {
      info: {
        title: 'orb API',
        version: '0.1.0',
        description: 'Event-driven automation and ingestion platform',
      },
      tags: [
        { name: 'System', description: 'Service status and metadata' },
        { name: 'Events', description: 'Event ingestion contract' },
      ],
    },
  }))
  .get('/health', () => ({
    status: 'ok' as const,
    service: 'orb-api' as const,
    version: '0.1.0',
  }), {
    detail: { tags: ['System'], summary: 'Health check' },
  })
  .get('/meta', () => ({
    name: 'orb',
    apiVersion: 'v1',
    capabilities: ['events', 'connectors', 'automation'],
  }), {
    detail: { tags: ['System'], summary: 'API capabilities' },
  })
  .post('/events/validate', ({ body }) => ({
    valid: true as const,
    event: body,
  }), {
    body: t.Object({
      id: t.String({ minLength: 1 }),
      type: t.String({ minLength: 1 }),
      source: t.String({ minLength: 1 }),
      subjectId: t.String({ minLength: 1 }),
      occurredAt: t.String({ format: 'date-time' }),
      observedAt: t.String({ format: 'date-time' }),
      schemaVersion: t.Integer({ minimum: 1 }),
      externalId: t.Optional(t.String()),
      correlationId: t.Optional(t.String()),
      payload: t.Record(t.String(), t.Unknown()),
    }),
    detail: {
      tags: ['Events'],
      summary: 'Validate an event envelope without persisting it',
    },
  })

export type OrbApi = typeof app

export default {
  fetch(request: Request, env: Bindings, context: ExecutionContext) {
    void env
    void context
    return app.fetch(request)
  },
}
