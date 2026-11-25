# Workflow parser

The shared @orb/workflow-core package is platform-independent TypeScript. YAML 1.2 AST with keepSourceTokens, structural diagnostics, semantic inspection and UTF-16 source ranges. No alias expansion or expression evaluation. The source is authoritative; transformations patch original text instead of serializing the entire document.

POST /v1/workflows/parse accepts {yaml}; returns diagnostics, jobs, inspector details and nodes with path, kind, range {from,to}. Ranges are half-open UTF-16 offsets compatible with CodeMirror. Traversal is capped at 20,000 nodes and depth 100. POST /v1/workflows/transform accepts {yaml,path,value}; currently supports replacement of existing untagged, unanchored inline string scalars only. Returns YAML, patches and updated model. Changed scalar uses JSON-compatible double quotes; untouched text remains unchanged. No GitHub writes. Both routes require Access identity.

## Planned adapters
Tree-sitter WASM for incremental syntax and embedded shell languages; GitHub actions/languageservices workflow-parser and expressions for semantic diagnostics. These are not installed in this increment. Benchmark Safari and Worker before requiring WASM; use explicit adapters, grammar lifecycle and UTF-8/UTF-16 mapping. Browser worker and backend share core contracts. Never execute workflow expressions or shell code. Full graph mutations, aliases, reusable resolution and semantic validation remain pending.

## Verification
API typecheck and dry-run are release gates. Fixed Workers TextDecoder constructor incompatibility by using supported constructor; malformed UTF-8 is decoded with replacement characters. Lockfile importer added for shared package using existing YAML version; CI must verify frozen install.

## Compatibility probe
The official parser adapter and syntax session are available via core exports. The isolated workflow-parser-probe workflow installs pinned official parser 0.3.61 and web-tree-sitter 0.27.2 without changing production dependencies, validates a positive and negative workflow, and initializes WASM. This is a compatibility gate only, not production integration. No grammar loaded yet; incremental edits and browser/Worker runtime verification remain pending. The syntax session performs full parses and owns tree disposal. Official validation returns normalized messages; no expression evaluation.

Probe failure ERR_IMPORT_ATTRIBUTE_MISSING in official package JSON imports on Node 22: bundle the probe with esbuild, externalizing web-tree-sitter so its WASM assets remain resolvable. Verification pending.
