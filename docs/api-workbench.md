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

Inspector forms now import the existing shared shadcn Button, Input and Textarea directly from apps/components/ui. Native selects remain until their value/event adapters are migrated. Tailwind explicitly scans the shared component directory. The existing apps workspace must be installed for shared Base UI and cn dependencies.

Structured inspector fields use compact CodeMirror 6 editors with existing YAML grammar (JSON-compatible flow syntax), One Dark, controlled synchronization, read-only compartments and external updates excluded from undo history. JSON.parse remains the submission validator. Shell-specific syntax is not yet implemented.

CI correction: Vite owns its shadcn control sources derived from the existing registry components, using native primitives and workspace-installed clsx/cva/tailwind-merge. The excluded Next app is not a runtime dependency. Consolidation into a shared package remains planned.

Preview configuration accepts JSONC comments and trailing commas introduced by formatting, preserving quoted strings. Generated Wrangler preview files remain strict JSON.

Preview concurrency cancels superseded runs. A stale SHA detected before deployment is reported as superseded and does not overwrite the current preview comment. Production environment approvals still apply.

Access authentication accepts the signed CF_Authorization application cookie when the assertion header is absent across the web service binding. Issuer, audience, expiry and RSA signature checks remain mandatory. This does not bypass Access.

Workspace mode hides HTTP operations and response tabs, defaults to graph inspector, and uses compact source/inspector presentation. /api retains HTTP lab controls. Local draft URLs open Studio directly. Shared editing engine remains unchanged.

Formatting publishes through the Orb GitHub App installation token (contents/workflows write), with the App bot identity. App credentials must be available to the format job at repository scope. GitHub Actions approval policies and production environment reviewers are separate settings; this change does not bypass them.

CI is consolidated into ci.yml with API, Web and workspace matrix checks. Production deploy.yml is manual, main-only, validates through reusable CI and orders API before Web. Existing production approval protections remain. Preview and maintenance workflows remain separate.

Maintenance consolidates automatic formatting and manual pnpm lockfile refresh/update, verifies typecheck and builds before App-authenticated push. The npm-only repair workflow and separate pnpm refresh workflow are retired. npm-operations remains for explicit custom operations pending migration of its script. Existing branch protection check names may need updating.

CI matrix includes the isolated official parser smoke. Maintenance accepts install/add/uninstall/custom and optional package arguments; custom commands are manual trusted-operator inputs. Only tracked changes and the pnpm lockfile are committed, so newly created custom files require explicit separate staging. Workflow YAML formatting is restored and requires App workflows permission. Old npm-operations and parser probe workflows are retired.

Shared local setup action pins Node/pnpm and optionally installs frozen dependencies. Parser matrix skips workspace installation. CI publishes a SHA-scoped web artifact reused by production in the same workflow run. Maintenance preflights repository-scoped App credentials without logging them. Preview retains independent build because it resolves the PR head separately.

Live AST parsing and Builder patches now run locally using the same workflow-core as the API. API Lab Send still performs real HTTP requests; Studio local Parse does not. GitHub repository access remains authenticated. Inspector hides empty forms and resets native fieldset styling. Explicit Studio/API Lab links distinguish modes.

### Kitchen Sink demo

Use Load demo to create a separate local draft with 10 jobs, matrix expansion, triggers, typed inputs, outputs, services, container, environments, expressions and reusable workflow syntax. The reusable target is intentionally illustrative and disabled. This fixture is not installed in .github/workflows and never dispatched by loading it.

Graph/AST selection highlights source without focusing or scrolling the page. Graph step clicks select the step inspector via URL. Existing run scalars and new shell steps have CodeMirror script editing; existing edits use reviewed source patches and reject comments/anchors/tags. Script editor currently uses plain text rather than a shell grammar. Graph fits topology changes, caps initial zoom, removes minimap and compacts dependencies.

Mobile workspace uses a compact two-row global header, File menu, scrollable document tabs and independent YAML/Graph/AST/Inspector panels. Graph step selection opens Inspector. Removed unsupported React Flow colorMode prop identified by CI. Desktop retains split panes.

### Mobile viewport

The standalone Orb web app requests a fixed viewport scale. Touch-device form controls and all CodeMirror editing surfaces use a minimum computed font size of 16px to prevent Safari focus zoom. React Flow retains its own gestures. Safari may override viewport zoom restrictions for accessibility; embedded hosts own their viewport settings.

Mobile graph and AST selection open the corresponding inspector immediately; workflow/job forms no longer require expanding a second accordion. Job selection follows URL state, and step forms reset when selection changes. Graph refits when its container becomes visible or resizes. Script patches remain explicitly reviewed.

Graph job selection keeps the graph visible so its step list remains reachable; step selection opens the inspector. AST navigation keeps the tree visible except for step selection. Explicit Show selected YAML reveals the linked range without focusing the editor. External source updates do not enter CodeMirror undo history. Dependencies are collapsed by default.

Step scripts now expose expand/collapse, reset, copy, line count and unsaved status. Configuration validates timeout and environment keys; graph labels shell steps as scripts. Structured editors use a darker background; shell syntax grammar remains pending.

Contextual condition and environment editors are available in job and step inspectors. Job output suggestions are restricted to direct needs; step output hints are inferred from earlier named script steps writing GITHUB_OUTPUT, not guaranteed runtime outputs. Job conditions omit matrix/env/steps contexts. Conditions support string comparison, contains, truthiness and AND/OR with raw escape hatch. Environment rows support literal and expression values. Existing complex fields still require manual YAML edits; suggestions do not enumerate repository secrets or remote action metadata.

Expression CodeMirror supports explicit reference completion and unique-prefix Tab completion. Previous action outputs are resolved using the existing manifest endpoint and shared TanStack Query cache (up to 30 distinct actions). Unavailable manifests fall back to local hints. Fixed strategy AST narrowing for TypeScript. Popup completion, reusable workflow resolution and repository metadata remain pending.

Native CodeMirror completion replaces unique-prefix Tab handling for expression fields. Ctrl-Space or the Autocomplete button opens suggestions; typing filters references. The direct autocomplete dependency is pinned to the already resolved lockfile version. Fixed malformed action-reference regex from previous commit.

Main YAML editor offers native expression completions inside open expression delimiters, scoped by AST job/step ranges. Stale AST is not used for scoped suggestions. Environment value composer uses the shared expression editor. Graph remains mounted on inspector selection so desktop layout is preserved; repository loading returns to graph in Studio. Main YAML completion currently uses local AST references, not remote manifest metadata.

Dispatch inspector supports typed input definitions, required/default/choices and a non-executing run form preview. Adding dispatch to a plain block trigger map preserves other events. Existing dispatch mappings and actual execution are not yet supported by this editor; use YAML or GitHub for those operations.

Dispatch patches now replace an existing plain dispatch subtree, preserving sibling triggers, and merge scalar/list trigger declarations into a mapping. Comments, aliases, anchors and tagged dispatch subtrees are rejected rather than silently discarded. Flow-style trigger maps remain unsupported. Execution is still preview-only.

Production dispatch endpoint requires verified Access identity, production Studio origin, configured GitHub App, repository allowlist and published workflow blob SHA. Inputs are checked against the published schema. Preview POST allowlist excludes dispatch. A successful response means accepted, not completed; no automatic retry or inferred run ID. GitHub App Actions write permission is required. UI integration pending.

Published dispatch runner loads source by selected ref, generates typed controls independently of the designer, displays blob SHA, requires explicit confirmation and disables execution outside production. Branch lookup is limited to first 100; tags and environments currently accept manual text. Accepted dispatch links to workflow runs, not a guessed run ID. No automatic retries.

Runner reads the repository gateway's data envelope, lists branches and tags, and fetches environments only for environment inputs. First 100 results are shown; manual entry remains available for incomplete or unavailable environment lists. Confirmation is tied to the published blob SHA. Empty optional typed controls are omitted. No dispatch values are persisted yet.

Dispatch history stores up to 50 attempts per repository/workflow in the existing Dexie session table. Records contain ref, blob SHA, time, accepted/unconfirmed status and optional workflow runs URL; no input values or tokens. History is local to the browser origin, can be cleared, and can restore a ref without executing anything. Unconfirmed attempts are not retried automatically. Presets and exact run tracking remain pending.
