# Orb API-first architecture

## Decisions

REST /v1 with Elysia and OpenAPI; GraphQL for GitHub discovery, REST for repository resources, SSE for future event subscriptions. D1 persistence, Queues for asynchronous processing, R2 for large logs and artifacts when needed. Durable Objects only when coordination requires them. Access JWT for browser reads; dedicated ingestion credentials for events; GitHub App preferred over dedicated read token. Never expose secrets to clients.

## Roadmap

1. Foundation: typed schemas, consistent errors, request IDs, OpenAPI, Scalar, Orval SDK, breaking-change checks.
2. GitHub gateway: repositories, branches, pulls, commits, workflows and runs.
3. Execution: dispatch, jobs, logs, rerun, cancel, auditing and operation-level authorization.
4. Builder: YAML parser, validation and Actions registry.
5. Events: SSE, replay, deduplication.
6. Automation: triggers, conditions, schedules, execution history.
7. Connectors and notifications: Relay, Notify!, Telegram and other adapters.

## Current increment

GET /v1/github/:owner/:repo/{branches,pulls,commits,actions/workflows,actions/runs}. Access identity and repository allowlist required. page 1–1000, limit 1–100 (defaults 1 and 30). Response {data,page,limit,hasNext}; data is the upstream GitHub JSON shape, not yet a normalized domain contract. Pulls include all states. Errors: 401 identity, 404 unavailable, 503 credentials, 429 rate limit, 502 upstream. No mutations. No shared caching of these responses. Upstream timeout 15 seconds.

## Consumer architecture

Independent TypeScript SDK with future Orval generation and separate React/TanStack Query entry. Host supplies client and authentication. Module Federation features must not depend on host router, global stores or layout. Workflow Builder owns instance state, React Flow and CodeMirror 6; controlled public contracts and injected services. Scoped CSS, configurable portals and explicit shared dependencies.

## Midnight design direction

Approved dark violet theme; Tailwind v4 and shadcn/ui only. Semantic tokens background, foreground, card, primary, muted, border, ring, success, warning, destructive, canvas, node, edge, selection. Theme values isolated; host overrides supported. No global remote resets. UI implementation deferred in favor of APIs.

## Delivery rules

Large integrated changes; TypeScript verification mandatory; tests only where necessary; docs updated with implementation. Intermediate commits [skip ci], final [deploy]. Sync main and inspect open PRs before work. PR descriptions include conversation URL when available. Do not mark planned capabilities as implemented.

## Remaining

Normalized response schemas, generated SDK, Scalar protection verification, request IDs, mutation idempotency, audit and project-level authorization beyond the allowlist remain pending. Verify via API CI and authenticated smoke requests after deployment.
