# 🪐 orb API

Elysia on Cloudflare Workers, with a D1 event ledger and Queue-backed dispatch.

## Provisioning

```bash
pnpm install
pnpm --filter @orb/api typecheck
pnpm --filter @orb/api dev
cd apps/api
pnpm exec wrangler d1 create orb-events
pnpm exec wrangler queues create orb-events
pnpm exec wrangler queues create orb-events-dlq
pnpm exec wrangler secret put ORB_INGEST_TOKEN
```

Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.jsonc` with the created database ID. Then run migrations:

```bash
pnpm exec wrangler d1 migrations apply orb-events --local
pnpm exec wrangler d1 migrations apply orb-events --remote
```

Only deploy after provisioning and validating the bindings.

## Routes

- `GET /v1/health`: public liveness
- `GET /v1/meta`: public API metadata
- `POST /v1/events/validate`: validate without persistence
- `POST /v1/events`: bearer-token protected, D1-backed idempotent ingestion
- `GET /v1/events/:id`: bearer-token protected processing status
- `GET /v1/openapi`: OpenAPI plugin documentation

## Important limitations

- The Queue consumer currently acknowledges **durable receipt only**; no connector-specific processing is implemented. Its `processed` status does not imply any external side effects.
- D1 insert and Queue send are not atomic. A scheduled sweep runs every five minutes and re-enqueues pending or stale queued records. This provides at-least-once delivery, not exactly-once processing.
- Concurrent retries of pending or stale events may enqueue duplicates. Consumers must remain idempotent. The initial consumer only records durable receipt, not connector-specific completion.
- A shared bearer token is only a bootstrap credential. Per-connector credentials, GitHub HMAC verification, authorization scopes, rate limiting, and retention are future work.
- Never put tokens in URL query parameters or log raw secrets.
- This milestone has not been runtime-verified against Cloudflare. Validate the build, migration, queue and OpenAPI before production deployment.
