# API Lab

Route /api. Same-origin authenticated real requests via existing Worker gateway. Select repository, ref, workflow path; load workflow-source, which populates YAML input, then select parse, validate, inspect or transform and send. Response shows actual HTTP status, elapsed time, UTF-8 body size, body and headers. Cancel via AbortController. No remote writes, no mock data, no credentials stored. Fixed operation catalog; no arbitrary external URLs. Existing API contracts unchanged. Current version uses native textarea and existing stylesheet semantic variables; CodeMirror 6, Tailwind/shadcn migration, OpenAPI-driven catalog, request history, resizable panes and production verification remain pending. Each backend feature should ship with a real API Lab operation in the same delivery.

AST tab consumes actual parse response nodes, supports path filtering, bounded rendering, and selects UTF-16 ranges in the YAML textarea. Selection is disabled when source differs from request snapshot. Selecting a node also fills the transform path. CodeMirror migration remains pending.

CodeMirror 6 YAML editor replaces textarea, with folding, search, line numbers, undo and AST range navigation. Deep links automatically load workflow source. Transformed AST ranges are disabled until transformed source is explicitly applied. Dependency lock refresh is required before frozen CI. One Dark is provisional pending semantic theme integration. No document tabs or reverse AST selection yet.

AST synchronization now follows editor selection start to the deepest containing UTF-16 range, reveals ancestors and scrolls active node into view. Tree branches can collapse/expand; Sync AST checkbox disables both directions of editor navigation. Source edits invalidate server ranges until reparse; no live network parsing yet. No new dependencies.

Live parser: optional automatic authenticated POST /v1/workflows/parse after 650 ms idle; abort on edits/unmount, reject stale ranges, keep manual API response independent. Diagnostics with offsets are marked inline in CodeMirror and clickable in AST panel; diagnostics without offsets remain listed. Live parse uses server parser, not WASM. No new dependencies.

Multi-document drafts use Dexie IndexedDB (orb-workflow-drafts), keyed by repository/ref/path. Opening a workflow restores existing local edits instead of overwriting them; tabs filter by current workspace. Editor instances reset per document. Closing a modified tab explicitly confirms deletion of local draft; no GitHub writes. Drafts persist on the same origin/browser, not across PR preview domains. Original snapshot is retained; upstream conflict detection and cross-device sync remain pending.

Graph tab uses existing React Flow dependency and parser jobs/needs/details/ranges. Dependency layers are deterministic; unresolved/cyclic jobs fall back to first column. Clicking jobs or steps selects source ranges, cursor highlights containing job. Pan/zoom/minimap supported; graph is read-only, capped at 300 jobs, no YAML mutation or new dependencies. Styles provisional.

Graph dependency editing: checkboxes propose authenticated edit-needs patches, explicit apply to local draft only, stale source prevents apply. Core supports plain block jobs and existing inline scalar/flow sequence needs or insertion before first key; complex/commented needs rejected rather than rewritten. Validates result including dependency cycles. No GitHub writes or new dependencies. Job creation, drag-connect and full diff pending.

Graph handles now accept drag connections to propose needs edits. Self/duplicate edges are blocked client-side; server validates cycles. Existing dependency removal remains in inspector. Pending proposals lock graph edits until applied/discarded. Patch review shows exact changed line span with three context lines; not a general multi-hunk diff. No remote writes or new dependencies.

Job & Step Editor proposes add-job (ubuntu-latest placeholder), duplicate-job and append run/uses step via authenticated /workflows/edit. Plain block collections only; unsupported shapes rejected. Shared patch review and explicit local apply. No remote execution or writes. Full Actions schema validation and deletion pending.

Action Inspector uses cached TanStack queries against existing authenticated GitHub gateway: search public actions, choose tags, resolve manifests, pin SHA, configure inputs and inspect outputs. Inputs are emitted as quoted YAML with fields in the reviewed patch. Required input validation applies when manifest is loaded. State type narrowing and formatter lockfile staging corrected.

Existing step editor proposes removal, adjacent movement, and insertion of missing if, timeout-minutes, continue-on-error and env fields. Existing configuration fields and ambiguous comment boundaries are rejected rather than overwritten. Formatter excludes workflow files until a workflow-write-capable App token is configured.

Local source tools support new YAML, pasted text, .yml/.yaml import up to 256 KiB and download. Local drafts use @local namespace and UUIDs in Dexie, available across repository contexts. The draft query parameter is device-local, not a shareable snapshot. Parsing and edits still use authenticated API. External CodeMirror updates do not trigger draft writes.

Job Inspector supports reviewed JSON-valued field patches for runner, strategy/matrix, permissions, concurrency, outputs, conditions, timeout, environment and existing reusable jobs. Missing fields and simple existing scalars are supported; complex existing YAML collections remain manual to preserve comments and anchors. No conversion between executable and reusable jobs.

Workflow Inspector: root-level reviewed patches for name, run-name, on, permissions, concurrency, env and defaults. Trigger presets cover push, pull_request, schedule, workflow_dispatch and workflow_call. Presets replace the draft trigger JSON, not the source until review. Existing block collections require manual editing; missing fields and simple scalars are supported.

Midnight migration: Tailwind v4 Vite plugin enabled without global preflight; semantic Orb tokens and URL-driven inspector navigation (`inspector=workflow|job|steps|add`). Existing forms remain mounted to preserve drafts. Shared shadcn/Base UI migration is a subsequent step.
