# 🪐 orb Workboard

Updated: 2026-11-21

## Status legend
- [ ] Planned / not verified
- [x] Verified complete

## Foundation
- [x] Create `rodkisten/orb` repository
- [x] Document monorepo architecture and routing conventions
- [ ] Commit pnpm workspace and install dependencies
- [ ] Configure Cloudflare deployments and environment bindings
- [ ] Establish typecheck, lint, format, and build CI

## Web
- [ ] Migrate uploaded Next.js 16 component catalog to `apps/web` with Vite + React 19
- [ ] Verify shadcn/ui + Tailwind v4 styles and component compatibility
- [ ] Install TanStack Router with file-based routes and typed search params
- [ ] Build `/design` component reference route
- [ ] Verify responsive iOS Safari layouts and theme switching

## API and SDK
- [ ] Elysia Worker + OpenAPI specification
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
