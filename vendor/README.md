# Shared Workflow Studio transport

Canonical source: https://github.com/rodkisten/shell/commit/968ff62

Versioned pnpm pack artifacts from packages/workflow-core and packages/workflow-studio. No editor or parser fork remains in orb. The @orb/workflow-core package is a compatibility re-export; orb keeps its authorized APIs, repository adapters and original draft database names. Public package publishing is pending. Rebuild core, pack both packages in Shell, then refresh this lockfile whenever upgrading.

SHA-256:

- `code-workflow-core-0.2.0.tgz`: `c2bfb0a9b305de6e6ec4be53bab9b1112f9e3e9b759e3d101e258d91503f0490`
- `code-workflow-studio-0.2.0.tgz`: `d5ff7133e841bc081d4060dbab03caea46e9ffcb43699de5caa65f5d43e33e13`

Verified after syncing main: workspace typecheck, web build, API tests and Worker dry-run. Real local Chromium smoke opened YAML, rendered the CST graph and reopened a URL draft in the original database. Private dispatch and authenticated production access were not exercised.

The official Actions parser/WASM CI probe consumes the exported `@code/workflow-core/adapters` entry from the same archive; it does not read removed orb source files. Local probe verified valid/invalid workflows and initialized/deleted the WASM parser.
