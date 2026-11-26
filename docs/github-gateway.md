# GitHub Gateway

## Authentication

Configure `ORB_GITHUB_APP_ID`, `ORB_GITHUB_APP_INSTALLATION_ID` and secret `ORB_GITHUB_APP_PRIVATE_KEY` in the production environment. A complete App configuration takes precedence; otherwise a dedicated `ORB_CI_READ_TOKEN` is used if available. An invalid complete App configuration fails rather than silently falling back. CI, logs and action discovery share this resolver. Grant metadata, contents and Actions read only as needed. Never reuse the bootstrap administration token at runtime.

## Endpoints

All paths below require a valid Cloudflare Access identity.

| Method | Path                                     | Purpose                                                   |
| ------ | ---------------------------------------- | --------------------------------------------------------- |
| GET    | /v1/github/repositories                  | Discover accessible repositories from ORB_CI_REPOSITORIES |
| GET    | /v1/github/gateway/metrics               | Cache metrics and configured authentication mode          |
| GET    | /v1/actions/search?q=...                 | Search public action repositories                         |
| GET    | /v1/actions/versions?owner=...&repo=...  | List public action tags                                   |
| GET    | /v1/actions/resolve?uses=...             | Resolve public action manifest                            |
| GET    | /v1/github/:owner/:repo/pulls/:number/ci | Latest PR CI failure and optional log excerpt             |

Repository discovery normalizes and deduplicates the configured allowlist, limits it to 100 entries, caches metadata for 120 seconds and reports inaccessible repositories separately. It does not enumerate arbitrary private repositories or expand the allowlist. The response is not browser-cacheable. Missing credentials return 503; upstream initialization failure returns 502.

Example response:

```json
{
  "repositories": [
    {
      "nameWithOwner": "rodkisten/orb",
      "description": null,
      "url": "https://github.com/rodkisten/orb",
      "isPrivate": false,
      "defaultBranchRef": { "name": "main" }
    }
  ],
  "unavailable": []
}
```

## Verification

Run `pnpm --filter @orb/api typecheck` and the API verification workflow. After deployment, call the endpoint using an authorized Access session. A successful core health check does not establish GitHub integration readiness.

## Cache and next steps

GraphQL cache keys currently depend on the actual token; rotation reduces cache reuse. Next: stable authorization scope, token reuse, bounded upstream concurrency, retry policies and workflow/job discovery.
