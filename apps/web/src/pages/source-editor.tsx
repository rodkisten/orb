import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { EditorView, Decoration, type DecorationSet } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";
import type { ParserDiagnostic } from "./live-parser";
const diagnosticsEffect = StateEffect.define<ParserDiagnostic[]>();
const diagnosticsField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    if (tr.docChanged) value = Decoration.none;
    for (const effect of tr.effects)
      if (effect.is(diagnosticsEffect)) {
        value = Decoration.set(
          effect.value.flatMap((d) =>
            d.offset !== null && d.offset >= 0 && d.offset < tr.state.doc.length
              ? [
                  Decoration.mark({
                    class: "orb-diagnostic-" + d.severity,
                    attributes: { title: d.message },
                  }).range(d.offset, d.offset + 1),
                ]
              : [],
          ),
          true,
        );
      }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});
export type SourceEditorHandle = { select: (from: number, to: number) => void };
export const SourceEditor = forwardRef<
  SourceEditorHandle,
  {
    value: string;
    onChange: (value: string) => void;
    onCursor?: (offset: number) => void;
    diagnostics?: ParserDiagnostic[];
  }
>(function SourceEditor({ value, onChange, onCursor, diagnostics }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const cursor = useRef(onCursor);
  cursor.current = onCursor;
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          diagnosticsField,
          basicSetup,
          yaml(),
          oneDark,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            "aria-label": "YAML source",
            autocapitalize: "off",
            spellcheck: "false",
          }),
          EditorView.theme({
            "&": { minHeight: "300px" },
            ".cm-scroller": { maxHeight: "65vh", overflow: "auto" },
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) change.current(u.state.doc.toString());
            if (u.selectionSet || u.docChanged)
              cursor.current?.(u.state.selection.main.from);
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
      });
  }, [value]);
  useEffect(() => {
    view.current?.dispatch({
      effects: diagnosticsEffect.of(diagnostics ?? []),
    });
  }, [diagnostics, value]);
  useImperativeHandle(
    ref,
    () => ({
      select(from, to) {
        const e = view.current;
        if (!e || from < 0 || to < from || to > e.state.doc.length) return;
        e.dispatch({
          selection: { anchor: from, head: to },
          effects: EditorView.scrollIntoView(from, { y: "center" }),
        });
        e.focus();
      },
    }),
    [],
  );
  return <div ref={host} />;
});
