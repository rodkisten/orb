# Shared Workflow Studio transport

Canonical source: https://github.com/rodkisten/shell/commit/93f3106

Versioned pnpm pack artifacts from packages/workflow-core and packages/workflow-studio. No editor or parser fork remains in orb. The @orb/workflow-core package is a compatibility re-export; orb keeps its authorized APIs, repository adapters and original draft database names. Public package publishing is pending. Rebuild core, pack both packages in Shell, then refresh this lockfile whenever upgrading.

SHA-256:

- `code-workflow-core-0.2.0.tgz`: `28166cf08f2daf634d9a7c0a180dd21b60c277883eb500a54eeefcf6dffa4d8d`
- `code-workflow-studio-0.2.0.tgz`: `d5ff7133e841bc081d4060dbab03caea46e9ffcb43699de5caa65f5d43e33e13`
