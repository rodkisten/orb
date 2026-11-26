import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorState, Compartment, Transaction } from "@codemirror/state";
import { EditorView, placeholder } from "@codemirror/view";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";

export function YamlEditor({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const initial = useRef(value);
  const editable = useRef(new Compartment());
  useEffect(() => {
    if (!host.current) return;
    const instance = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          basicSetup, yaml(), oneDark, EditorView.lineWrapping,
          placeholder("Paste YAML or import a workflow"),
          editable.current.of([EditorState.readOnly.of(false), EditorView.editable.of(true)]),
          EditorView.contentAttributes.of({ autocapitalize: "off", autocorrect: "off", spellcheck: "false", "aria-label": "Workflow YAML editor" }),
          EditorView.theme({ "&": { height: "min(65vh, 680px)", minHeight: "280px", fontSize: "12px" }, ".cm-scroller": { overflow: "auto" } }),
          EditorView.updateListener.of(update => {
            if (update.docChanged && !update.transactions.some(t => t.annotation(Transaction.userEvent) === "external.sync")) callback.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = instance;
    return () => { instance.destroy(); view.current = null; };
  }, []);
  useEffect(() => {
    const instance = view.current;
    if (instance && instance.state.doc.toString() !== value) instance.dispatch({ changes: { from: 0, to: instance.state.doc.length, insert: value }, annotations: [Transaction.userEvent.of("external.sync"), Transaction.addToHistory.of(false)] });
  }, [value]);
  useEffect(() => {
    view.current?.dispatch({ effects: editable.current.reconfigure([EditorState.readOnly.of(disabled), EditorView.editable.of(!disabled)]) });
  }, [disabled]);
  return <div ref={host} className="min-w-0 overflow-hidden rounded-md border" />;
}
