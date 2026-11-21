# 🪐 orb Workboard

Updated: 2026-11-21

## Status legend
- [ ] Planned / not verified
- [x] Verified complete

## Foundation
- [x] Create `rodkisten/orb` repository
- [x] Document monorepo architecture and routing conventions
- [x] Commit pnpm workspace skeleton (dependencies not yet installed)
- [ ] Configure Cloudflare deployments and environment bindings
- [ ] Establish typecheck, lint, format, and build CI

## Web
- [ ] Migrate uploaded Next.js 16 component catalog to `apps/web` with Vite + React 19
- [ ] Verify shadcn/ui + Tailwind v4 styles and component compatibility
- [ ] Install TanStack Router with file-based routes and typed search params
- [ ] Build `/design` component reference route
- [ ] Verify responsive iOS Safari layouts and theme switching

## API and SDK
- [x] Commit initial Elysia Worker routes and OpenAPI configuration (runtime validation pending)
- [ ] Generate typed SDK with `@hey-api/openapi-ts`
- [ ] TanStack Query integration and contract checks
- [ ] SSE with replay / event IDs

## Automations
- [ ] GitHub App webhook validation, deduplication, and TODO-to-Issue engine
- [ ] Cloudflare Queues and durable workflows
- [ ] Event Explorer, execution inspector, and future log viewer
- [ ] Manage and Relay integrations

## Jardim ingestion
- [ ] Spotify OAuth, sync and historical import
- [ ] TMDB / IMDb metadata connectors
- [ ] YouTube imports and verified activity events
- [ ] PhotoIntel integration, enrichment, and timeline events
- [ ] Backfill, provenance, consent, and retention policies

## Engineering decisions
- pnpm workspaces, **no Turborepo** initially.
- Strict Tailwind CSS v4 + shadcn/ui styling.
- TanStack Router: shareable navigation state in URL; no secrets in URL.
- React 19 + Vite for web, Elysia + Workers for API.
- OpenAPI generated client via Hey API.
- Experimental tools require pinned versions, compatibility verification and rollback plan.
- Update this board only after verifying completion; use large coherent changes.

## API bootstrap notes (2026-11-21)

- Committed `apps/api` Elysia Worker, `/v1/health`, `/v1/meta`, `/v1/events/validate`, and OpenAPI configuration to `main`.
- **Not verified yet:** dependency installation, TypeScript compilation, Worker runtime, endpoint behavior, and OpenAPI spec generation.
- Validation endpoint does not ingest or persist data. Authentication, idempotency, durable storage, replay protection, and GitHub signature verification remain planned.
