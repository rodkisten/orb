# Workflow Builder API

## Implemented read and validation endpoints
Both require Cloudflare Access identity. Source lookup also requires the repository allowlist and GitHub Contents read permission.

GET /v1/github/:owner/:repo/workflow-source?path=.github/workflows/ci.yml&ref=main

Returns repository, path, requested ref (null means GitHub default branch), blob SHA, original UTF-8 YAML, valid, diagnostics and jobs. Source limited to 256 KiB and direct workflow YAML files. Blob SHA is intended for future optimistic concurrency, not a branch commit SHA.

POST /v1/workflows/validate
Content-Type: application/json

{"yaml":"name: CI\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps: []"}

Returns valid, diagnostics (severity, message, character offset or null), jobs (id and needs). Invalid workflow documents return HTTP 200 with valid=false. Checks YAML syntax, duplicate keys, trigger presence, job mapping, IDs, dependency references and cycles. This is structural validation, not full GitHub Actions semantic validation. No alias expansion or expression execution. No persistence or GitHub writes.

## Integration
Use original YAML as the source of truth. Graph nodes derive from jobs and edges from needs. Preserve comments and formatting using a YAML AST in the editor. Existing Actions search/resolve/version endpoints supply registry data. Future endpoints: full schema diagnostics, reusable workflow resolution, step graph, optimistic save on branch, PR creation and dispatch. SDK and response schema generation pending. Keep builder independent of host router, store and auth; inject client via public contracts.

## Verification
Run API typecheck and authenticated smoke requests. No new dependency required.

## Inspector increment
POST /v1/workflows/inspect accepts the same YAML payload as validate. Returns validation plus triggerNames, interface (workflow_call input/output/secret names and dispatch input names), details (job IDs, reusable workflow references, input/output names, ordered steps, action references, step kind and environment key names). No secret values, shell execution, alias expansion or remote resolution. Remote action manifests remain available via existing /v1/actions/resolve. Reusable workflow remote resolution and full typed metadata remain pending.

## Regression repair
Rebuilt index.ts from the last pre-gateway baseline and reapplied all eight read/validation/inspection routes using literal replacement callbacks to avoid JavaScript replacement-string dollar expansion. CI typecheck required before release.
