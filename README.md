# 🪐 orb

Event ingestion, automation, and observability hub for GitHub, Jardim, PhotoIntel, Manage, and Relay.

## Architecture

- **Monorepo:** pnpm workspaces, without Turborepo
- **Web:** React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS v4, shadcn/ui
- **API:** Elysia on Cloudflare Workers, OpenAPI
- **SDK:** @hey-api/openapi-ts
- **Async:** Cloudflare Queues, Workflows, SSE
- **Integrations:** GitHub App, Spotify, YouTube, TMDB, PhotoIntel, Jardim, Manage, Relay

## Routing contract

All shareable navigation state belongs in the URL: selected workspace, search, filters, tabs, sort, pagination, and entity identifiers. Use typed TanStack Router search params. Keep credentials and sensitive values out of URLs.

## Design system

Use **only Tailwind CSS v4 and shadcn/ui**. The uploaded Next.js component catalog is a reference to migrate into `apps/web` as a Vite application, not a reason to adopt Next.js.

## Status

Planning and initial repository documentation. See [workboard](docs/WORKBOARD.md). Implementation is not yet complete.
