# GitHub Gateway

Configure ORB_GITHUB_APP_ID and ORB_GITHUB_APP_INSTALLATION_ID as Worker variables, ORB_GITHUB_APP_PRIVATE_KEY as a Wrangler secret. Grant only repository metadata and contents read for the registry. Existing CI token remains a fallback when no App settings exist; partial App settings fail closed. Never expose credentials or arbitrary GraphQL operations to browsers.

The gateway exposes internal GraphQL reads and REST GET operations. Existing CI endpoints retain their current authentication until migrated and tested. Cache keys currently depend on the actual token, so installation token rotation reduces cache reuse. Next: stable authorization scope, token reuse, retry policies, webhook invalidation and integration tests.
