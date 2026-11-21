# 🪐 orb API

Elysia API on Cloudflare Workers. The initial milestone intentionally includes **no database writes, auth bypasses, or pretend ingestion**.

## Commands

```bash
pnpm install
pnpm --filter @orb/api dev
pnpm --filter @orb/api typecheck
pnpm --filter @orb/api deploy
```

## Endpoints

- `GET /v1/health`: liveness
- `GET /v1/meta`: capabilities
- `POST /v1/events/validate`: validates an event envelope, **does not persist**
- `GET /v1/openapi`: OpenAPI UI/spec endpoint, subject to plugin defaults

## Next milestones

1. Verify Elysia + Workers runtime and OpenAPI generation.
2. Generate a typed SDK with Hey API.
3. Add signed webhook verification, authentication, idempotent event storage, queues and replay.
4. Integrate with Jardim, PhotoIntel, GitHub and Relay.

Do not deploy event ingestion without authentication, provenance checks and replay protection.
