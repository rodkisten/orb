# Composite GitHub MCP operations

Goal: one MCP call per investigation, not one call per REST endpoint. Keep granular tools available. Reuse the existing GitHub client, authorization, pagination and redaction. Read-only by default.

| Tool                            | Aggregated result                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| github_pr_logs                  | PR head SHA, matching workflow runs, jobs, failed steps and bounded failure logs   |
| github_repository_ci            | Repository workflows, latest relevant runs, status, jobs and optional failure logs |
| github_pr_overview              | PR metadata, mergeability, reviews, checks, changed files summary and CI           |
| github_repository_overview      | Default branch, open PRs/issues summary, latest CI and deployments                 |
| github_workflow_diagnose        | Run status, failed jobs, failed steps, annotations and bounded logs                |
| github_pr_review_context        | PR overview, bounded diff, review threads and unresolved checks                    |
| github_repository_configuration | Environments, variable names and secret names, never values                        |
| github_branch_health            | Branch SHA, divergence from base, associated PRs and checks                        |
| github_multi_repo_ci            | Bounded parallel CI summaries across explicitly allowed repositories               |

## Contracts

- Resolve PR head SHA once and pin subsequent queries; report stale head if detected.
- Include workflow/run/job identifiers and links; distinguish queued, running, failed, cancelled and successful.
- Default to latest relevant run per workflow, failures-only logs, exclude unrelated SHAs; expose optional branch/ref and bounded history.
- For PRs include relevant check runs and report workflows not attributable to the pinned SHA separately, never silently mix them.
- Bound fan-out, concurrency, total bytes, per-job bytes and deadline; return partial results with explicit errors and truncation flags.
- Never follow arbitrary URLs or forward credentials to signed log hosts; reuse existing guarded log retrieval.
- Redact logs before returning; no raw secret values, no raw diagnostic payload persistence.
- Preserve repository allowlist on every operation, including multi-repository calls.
- No automatic retries of mutations, no automatic reruns or merges in diagnostic tools.
- Provide machine-readable summaries plus actionable failure details; do not invent root causes.
- Test pagination, SHA selection, partial failures, budget exhaustion, redaction and authorization with fixtures; smoke test against a known PR.

## Delivery order

1. Extract reusable read/log functions from existing MCP handlers.
2. Implement github_pr_logs and github_repository_ci.
3. Implement workflow diagnosis and PR overview using the same aggregation engine.
4. Add remaining composite read tools and focused tests.
