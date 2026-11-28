# Orb Preview Gateway

Phase 1: additive D1 registry and authenticated read API. No public routing or mutation yet.

Canonical hostname: project-prN.migos.club (first-level subdomain for Universal SSL). Existing custom domains remain untouched. Public gateway must be separate from the Access-protected administrative API. Do not route arbitrary hostnames or user-provided upstream URLs: validate project allowlist and trusted deployment targets. Avoid a broad wildcard Worker route that intercepts existing production applications. Validate routing, TLS and free-tier limits before provisioning.

Lifecycle: building, ready, failed, removed. A future authenticated CI writer must reject stale run updates and register only verified upstream deployments. Cleanup must be idempotent. Preserve immutable module SHA paths and isolate cookies, storage, and preview secrets. Pilot: RodSandbox. No fork deployment.

GET /v1/previews requires existing Access identity and returns up to 200 recent records. Migration 0003 must be applied before enabling the endpoint in production.
