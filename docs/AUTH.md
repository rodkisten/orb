# 🔐 orb authentication and deployment gates

## Browser reads: Cloudflare Access

The API's `GET /v1/events` and `GET /v1/events/:id` require a cryptographically verified Cloudflare Access JWT, supplied in the `Cf-Access-Jwt-Assertion` request header by a properly configured Cloudflare Access application.

Required Worker environment variables:
- `CF_ACCESS_TEAM_DOMAIN`: the team domain, e.g. `your-team.cloudflareaccess.com`.
- `CF_ACCESS_AUD`: the Access application's AUD tag.

Verification checks RS256 signature against the team's published JWKS, exact issuer, audience, expiration, not-before, and nonempty subject. Missing or invalid configuration denies access. The token is **never** accepted from URL parameters. The browser does not need to manage JWTs directly when Cloudflare Access fronts the API.

**Important:** This is an authentication gate, not project-level authorization. All authenticated users currently have access to all events. Restrict Access application membership to trusted operators only. Do not enable public access until project-level authorization, retention/redaction, and deployment verification are complete. Cloudflare Access must protect the API hostname; placing the UI on a separate hostname requires carefully configured same-origin routing or Access policies.

## Ingestion

- `POST /v1/webhooks/github` verifies the GitHub HMAC-SHA256 delivery signature against `GITHUB_WEBHOOK_SECRET` before parsing.
- `POST /v1/events` retains the legacy `ORB_INGEST_TOKEN` bootstrap bearer gate. **Do not treat this as final integration authorization.**
- `POST /v1/events/validate` is a public validation-only endpoint and does not persist data.

## Remaining deployment gates

1. Install dependencies, generate lockfile, and pass TypeScript, frontend build, and Wrangler dry-run.
2. Apply D1 migrations and configure Cloudflare Access application, hostname policy, AUD, and team domain.
3. Set the GitHub webhook secret in Cloudflare and the matching GitHub App configuration.
4. Implement per-integration scoped credentials, project-level authorization, rate limits, payload retention/redaction, and replay controls.
5. Validate Access-protected reads and real signed webhook deliveries before opening public routes.
