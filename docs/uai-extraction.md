# UAI extraction contract

Shared presentation components live in apps/web/src/components/shared. They use React, shadcn primitives, Lucide and Tailwind semantic tokens. They must not import Orb routes, API clients or Dexie. Feature adapters own application state and side effects.

Initial candidates: inspector-fields and panel-navigation. Existing inspector-fields import is preserved by a compatibility re-export. Registry publication is a separate step; resolve the UAI registry dependency conventions before moving files. No duplicate primitive implementations.

Validate formatting, typecheck and mobile behavior before registry publication.

CodeEditor now owns the existing CodeMirror lifecycle; StructuredEditor adapts GitHub-specific labels. ExpressionInput and KeyValueEditor expose controlled generic interfaces. KeyValueEditor preserves stable row IDs and duplicate keys during editing; consumers validate before serializing. The latter two are candidates, not yet wired into all feature forms. Existing editor theme is retained; full theme token migration and schema form remain pending.
