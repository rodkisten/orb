# Orb Smart Commit

Generate meaningful Conventional Commit suggestions before publication. Never rewrite published history or grant the generator Git write access.

## API

Proposed authenticated POST /v1/git/commit-message. Request: repository, branch, originalMessage, files (path and unified diff), optional language. Response: status (suggested, unchanged, rejected), message, optional description, type, scope, breaking, semverSuggestion. The server derives authorization from the authenticated principal, not request fields.

## Policy

Default disabled until repository opt-in. Match anchored generic GitHub defaults (Update, Create, Delete, Rename, Add files via upload). Preserve intentional messages and explicit [skip ci] and [deploy] markers. Never introduce these markers from model output. On failure keep original. Require explicit review for breaking changes. Never automatically submit a commit; update the editable field only.

## Security

Filter sensitive paths and redact secrets before sending any diff to a model; deny suspicious or unclassifiable payloads. Limit request bytes and file count; do not silently truncate and claim complete analysis. Treat all diff content as untrusted data, not instructions. No model tools or Git write access. No raw diff in logs, analytics or durable storage. Authenticate and authorize repository access, rate limit per principal, and enforce provider timeouts. Provider credentials stay server-side. Browser clients must not embed service credentials.

## Implementation

Reuse Elysia request schemas, existing Access authentication, Octokit and workspace conventions. Evaluate diff, commitlint and AI SDK for Worker compatibility before adding dependencies. Keep generation behind a provider interface. Validate generated conventional messages and derive SemVer suggestions deterministically; UAI remains authoritative for releases. Settings are global with repository overrides.

GitHub userscript: capture actual editor changes, show suggestion and restore-original action, abort stale requests on edits/navigation, preserve native submission and never bypass confirmation. Use existing React/Radix/shadcn runtime and authenticated Orb transport. Later clients: Shell, Sandbox, Manage and shared Actions.

## Acceptance

Generic message gets a meaningful suggestion; intentional message is unchanged; sensitive diff is rejected; provider failure preserves original; breaking changes require review; stale responses cannot overwrite newer edits. Typecheck and focused unit tests before deployment. No provider or endpoint is implemented by this document.
