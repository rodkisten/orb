# UAI extraction contract

Shared presentation components live in apps/web/src/components/shared. They use React, shadcn primitives, Lucide and Tailwind semantic tokens. They must not import Orb routes, API clients or Dexie. Feature adapters own application state and side effects.

Initial candidates: inspector-fields and panel-navigation. Existing inspector-fields import is preserved by a compatibility re-export. Registry publication is a separate step; resolve the UAI registry dependency conventions before moving files. No duplicate primitive implementations.

Validate formatting, typecheck and mobile behavior before registry publication.

CodeEditor now owns the existing CodeMirror lifecycle; StructuredEditor adapts GitHub-specific labels. ExpressionInput and KeyValueEditor expose controlled generic interfaces. KeyValueEditor preserves stable row IDs and duplicate keys during editing; consumers validate before serializing. The latter two are candidates, not yet wired into all feature forms. Existing editor theme is retained; full theme token migration and schema form remain pending.

SchemaForm renders controlled string, number, boolean, choice and environment fields with accessible labels and optional externally supplied validation errors. DispatchEditor uses it for the run-form preview; actual dispatch validation remains in the runner. ConditionField and EnvField now use ExpressionInput. KeyValueEditor integration is deferred until the env serialization adapter preserves incomplete and malformed rows without data loss.

PatchReview is now shared, with configurable title and bounded scroll. It retains the existing single changed-range algorithm, not a full multi-hunk diff. Studio mobile panel navigation uses PanelNavigation; URL state remains in the feature adapter. WorkbenchLayout extraction is deferred until desktop/mobile pane CSS is audited.

SessionAlert and ExecutionTracker now separate presentation from session polling and GitHub run queries. The adapters retain authentication and exact run links. WorkbenchLayout remains pending because responsive CSS selectors couple source and inspector visibility to the existing DOM.
