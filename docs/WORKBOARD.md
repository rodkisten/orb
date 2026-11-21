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
- [x] Commit Hey API SDK generator scaffold (generation and version compatibility pending)
- [ ] Generate and verify actual SDK from exported OpenAPI JSON
- [ ] TanStack Query integration and contract checks
- [ ] SSE with replay / event IDs

## Automations
- [ ] GitHub App webhook validation, deduplication, and TODO-to-Issue engine
- [x] Commit D1 event ledger and Cloudflare Queue producer/consumer skeleton (provisioning and runtime verification pending)
- [x] Commit scheduled outbox recovery sweep (runtime validation pending)
- [ ] Implement connector handlers, dead-letter inspection and durable workflows
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

## Event Core milestone (2026-11-21)

- [x] Commit event schema, D1 migration, idempotent insert, bearer token gate, Queue producer and consumer skeleton.
- [x] Document Cloudflare resource provisioning, migration commands, and known failure modes.
- [ ] Verify dependencies, TypeScript compilation, migration, OpenAPI output and Worker behavior.
- [ ] Implement outbox recovery sweep and atomic processing state transitions.
- [ ] Implement real connector handlers before treating `processed` as business completion.
- [ ] Add webhook-specific HMAC verification, replay-window validation and per-connector permissions.

## Reliability follow-up (2026-11-21)

- [x] Add five-minute cron recovery for pending and stale queued events.
- [x] Add API CI workflow for TypeScript and Wrangler dry-run build (execution pending).
- [ ] Verify CI result and fix actual compilation/runtime errors.
- [ ] Generate and commit pnpm lockfile after successful install.
- [ ] Add queue delivery state distinct from connector processing completion.
- [ ] Add atomic lease/claim to prevent competing outbox sweep dispatches.
- [ ] Add authenticated connector processing, DLQ replay tooling and observability.

## SDK and event list milestone (2026-11-21)

- [x] Commit authenticated `GET /v1/events` with source/type/status filters and offset pagination.
- [x] Commit Hey API configuration and SDK workspace package scaffold.
- [x] Document URL-first TanStack Router contract in `docs/URL_STATE.md`.
- [ ] Export actual OpenAPI JSON from Elysia and generate client code.
- [ ] Install dependencies, pin verified versions, commit lockfile and pass CI.
- [ ] Integrate the generated SDK with TanStack Query and the real web app.
- [ ] Add Event Explorer UI with typed TanStack Router search params.

## URL-first web bootstrap (2026-11-21)

- [x] Commit `apps/web` Vite + React 19 + TanStack Router + TanStack Query scaffold.
- [x] Commit URL-backed Event Explorer controls: project, source, type, status, sort, page size, page, view, selected event, detail panel.
- [x] Commit API sort support and web build verification workflow.
- [ ] Verify GitHub Actions run and fix compilation errors.
- [ ] Replace temporary native controls/CSS with required Tailwind CSS v4 and shadcn/ui.
- [ ] Import uploaded reference component catalog into `apps/web`.
- [ ] Add secure server-managed browser session for protected API reads.
- [ ] Add backend project scoping; current project URL param does not filter API results.
- [ ] Generate and integrate Hey API client from actual OpenAPI output.

## Cloudflare provisioning (2026-11-21)

- [x] Confirm connected Cloudflare account and inspect existing Workers, D1 databases and Queues.
- [x] Create D1 `orb-events`, Queue `orb-events` and DLQ `orb-events-dlq`.
- [x] Update Wrangler D1 binding to actual provisioned database ID.
- [ ] Apply D1 migration remotely, set `ORB_INGEST_TOKEN`, validate Worker build and deploy.
- [ ] Confirm `GET /v1/health` on a deployed endpoint and verify queue consumption.
- [ ] Add production-safe auth/session model before exposing the Event Explorer.

## Dependency and CI hardening (2026-11-21)

- [x] Pin pnpm 12.22.0 consistently across root manifest and GitHub Actions.
- [x] Remove unconditional dependency build-script approval from lockfile workflow.
- [x] Extend lockfile verification to frontend build and Worker dry-run.
- [x] Load selected event by ID, independently of current URL pagination.
- [ ] Run `refresh-lockfile.yml` with `run_checks=true` and `commit_changes=true`; confirm lockfile commit and fix any failures.
- [ ] Complete authenticated frontend access before deploying production UI.
