# 🪐 orb typed SDK

Hey API generated client for the orb Elysia OpenAPI contract, with TanStack Query helpers.

## Generation

1. Start the API locally after provisioning D1 and Queue bindings.
2. Export the OpenAPI JSON to `apps/api/openapi.json`.
3. Run `pnpm --filter @orb/sdk generate`.

The OpenAPI JSON export is **not yet automated**, and no generated code is committed yet. The SDK config is a scaffold pending compatibility verification against the installed Hey API version.

## URL-first UI

TanStack Router owns typed URL search state. TanStack Query uses that state as query keys and request parameters. Keep credentials in server-managed sessions, never in search params.
