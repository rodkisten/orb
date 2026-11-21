# 🪐 orb web

React 19 + Vite + TanStack Router + TanStack Query.

The URL is the source of truth for shareable navigation state. The Event Explorer exposes project, source, type, status, view, pagination and selected detail panel in typed search params.

## Run

```bash
pnpm install
pnpm --filter @orb/web dev
```

The Vite development proxy forwards `/v1` to `localhost:8787`. The API requires bearer authentication and does not yet implement browser sessions, so the explorer intentionally displays an authentication error instead of embedding secrets in the browser.

## Current limitations

- The frontend is a functional routing/data-fetching scaffold, **not** the previously uploaded shadcn reference catalog. That catalog has not been committed.
- Project selection is URL state only; the API does not yet filter by project.
- Sort is URL state only; the API currently orders newest first.
- The initial interface uses temporary native controls; migrate them to shadcn/ui and Tailwind v4 before production.
- No dependency installation, browser runtime check or build validation has been performed yet.
