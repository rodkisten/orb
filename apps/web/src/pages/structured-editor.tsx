import { useEffect, useRef } from "react";
import {
  Annotation,
  Compartment,
  EditorState,
  Transaction,
} from "@codemirror/state";
import { EditorView, placeholder as hint } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";
const external = Annotation.define<boolean>();
export function StructuredEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "",
  script = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  script?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const access = useRef(new Compartment());
  const hints = useRef(new Compartment());
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          ...(script ? [] : [yaml()]),
          oneDark,
          EditorView.theme(
            {
              "&": { backgroundColor: "#212121" },
              ".cm-gutters": { backgroundColor: "#212121", color: "#999" },
              ".cm-activeLine,.cm-activeLineGutter": {
                backgroundColor: "#303030",
              },
            },
            { dark: true },
          ),
          EditorView.lineWrapping,
          access.current.of([
            EditorState.readOnly.of(disabled),
            EditorView.editable.of(!disabled),
          ]),
          hints.current.of(hint(placeholder)),
          EditorView.contentAttributes.of({
            "aria-label": script ? "Shell script" : "Structured JSON value",
            autocapitalize: "off",
            spellcheck: "false",
            autocorrect: "off",
          }),
          EditorView.theme({
            "&": { fontSize: "12px", borderRadius: "8px", overflow: "hidden" },
            ".cm-scroller": {
              minHeight: script ? "160px" : "48px",
              maxHeight: script ? "45vh" : "220px",
              overflow: "auto",
            },
            ".cm-content": { padding: "6px 0" },
          }),
          EditorView.updateListener.of((u) => {
            if (
              u.docChanged &&
              !u.transactions.some((t) => t.annotation(external))
            )
              change.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      view.current = null;
      editor.destroy();
    };
  }, []);
  useEffect(() => {
    const e = view.current;
    if (e && e.state.doc.toString() !== value)
      e.dispatch({
        changes: { from: 0, to: e.state.doc.length, insert: value },
        annotations: [external.of(true), Transaction.addToHistory.of(false)],
      });
  }, [value]);
  useEffect(() => {
    view.current?.dispatch({
      effects: access.current.reconfigure([
        EditorState.readOnly.of(disabled),
        EditorView.editable.of(!disabled),
      ]),
    });
  }, [disabled]);
  useEffect(() => {
    view.current?.dispatch({
      effects: hints.current.reconfigure(hint(placeholder)),
    });
  }, [placeholder]);
  return (
    <div
      ref={host}
      className="min-w-0 overflow-hidden rounded-lg border border-border"
    />
  );
}
