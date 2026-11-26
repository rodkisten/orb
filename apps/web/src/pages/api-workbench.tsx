import type { OpenWorkflow } from "../workspace/explorer";
import { useRef, useState, useEffect } from "react";
import { Send, Copy, Square, FolderGit2 } from "lucide-react";
import { updateRoute } from "../workspace/state";
import { LocalSourceTools } from "./local-source-tools";
import { useWorkspace } from "../workspace/context";
import { SourceEditor, type SourceEditorHandle } from "./source-editor";
import { useDrafts, documentId, type Draft } from "./drafts";
import { useLiveParser } from "./live-parser";
import { BuilderForm, type BuilderEdit } from "./builder-form";
import { PatchReview } from "./patch-review";
import { WorkflowGraph } from "./workflow-graph";
import { AstExplorer } from "./ast-explorer";
const operations = [
  "health",
  "github/repositories",
  "branches",
  "pulls",
  "commits",
  "actions/workflows",
  "actions/runs",
  "workflow-source",
  "parse",
  "validate",
  "inspect",
  "transform",
] as const;
type Operation = (typeof operations)[number];
type Result = {
  status: number;
  ms: number;
  bytes: number;
  body: string;
  headers: string;
};
const parserOps = ["parse", "validate", "inspect", "transform"];
export function ApiWorkbench({ file }: { file?: OpenWorkflow } = {}) {
  const { repos } = useWorkspace();
  return (
    <Lab
      key={repos.join(",") + JSON.stringify(file ?? null)}
      repos={repos}
      file={file}
    />
  );
}
function Lab({ repos, file }: { repos: string[]; file?: OpenWorkflow }) {
  const studio = location.pathname !== "/api";
  const [operation, setOperation] = useState<Operation>("workflow-source");
  const [repo, setRepo] = useState(() => {
    const r = file?.repo ?? new URLSearchParams(location.search).get("repo");
    return r && repos.includes(r) ? r : (repos[0] ?? "");
  });
  const [ref, setRef] = useState(
    () =>
      file?.ref ?? new URLSearchParams(location.search).get("ref") ?? "main",
  );
  const [path, setPath] = useState(
    () =>
      file?.path ??
      new URLSearchParams(location.search).get("path") ??
      ".github/workflows/api-verify.yml",
  );
  const [yaml, setYaml] = useState("");
  const drafts = useDrafts(repos);
  const [opened, setOpened] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState("");
  const [nodePath, setNodePath] = useState('["name"]');
  const [value, setValue] = useState("Orb verification");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"body" | "headers" | "ast" | "graph">(
    studio ? "graph" : "body",
  );
  const editor = useRef<SourceEditorHandle>(null);
  const [parsedSource, setParsedSource] = useState("");
  const active = useRef<AbortController | null>(null);
  const [transformed, setTransformed] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{
    source: string;
    yaml: string;
  } | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [sync, setSync] = useState(true);
  const [live, setLive] = useState(true);
  const parsed = useLiveParser(yaml, live);
  const astBody = live ? parsed.body : (result?.body ?? "");
  const astStale = live
    ? parsed.source !== yaml
    : yaml !== (transformed ?? parsedSource);
  const autoLoaded = useRef(false);
  const local = opened?.repo === "@local";
  function openLocal(source: string, filename: string) {
    if (busy || editBusy) return;
    const d: Draft = {
      id: crypto.randomUUID(),
      repo: "@local",
      ref: "local",
      path: filename,
      yaml: source,
      original: source,
      updatedAt: Date.now(),
    };
    switchDocument(d);
    void drafts.save(d).catch((e) => setDraftError(String(e)));
  }
  const documentKey = documentId(repo, ref, path);
  function editYaml(value: string) {
    setYaml(value);
    if (opened) {
      const next = { ...opened, yaml: value, updatedAt: Date.now() };
      setOpened(next);
      void drafts.save(next).catch((e) => setDraftError(String(e)));
    }
  }
  async function propose(endpoint: string, payload: object) {
    if (editBusy || busy) return;
    const source = yaml;
    setEditBusy(true);
    setProposal(null);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml: source, ...payload }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.yaml !== "string")
        throw Error(data.error ?? "Dependency edit failed");
      setProposal({ source, yaml: data.yaml });
    } catch (e) {
      setError(String(e));
    } finally {
      setEditBusy(false);
    }
  }
  function editNeeds(job: string, needs: string[]) {
    void propose("/v1/workflows/edit-needs", { job, needs });
  }
  function editJob(edit: BuilderEdit) {
    void propose("/v1/workflows/edit", { edit });
  }
  function switchDocument(d: Draft) {
    if (active.current || editBusy) return;
    setProposal(null);
    if (d.repo === "@local") {
      setOperation("parse");
      updateRoute({ draft: d.id });
    } else {
      updateRoute({ draft: null });
    }
    setRepo(d.repo);
    setRef(d.ref);
    setPath(d.path);
    setOpened(d);
    setYaml(d.yaml);
    setResult(null);
    setTransformed(null);
    setParsedSource("");
    setCursor(0);
    setTab(studio ? "graph" : "ast");
  }
  function detach() {
    setProposal(null);
    updateRoute({ draft: null });
    setOpened(null);
    setYaml("");
    setResult(null);
    setTransformed(null);
    setParsedSource("");
  }
  const post = parserOps.includes(operation);
  const encodedRepo = repo.split("/").map(encodeURIComponent).join("/");
  const endpoint = post
    ? "/v1/workflows/" + operation
    : operation === "health" || operation === "github/repositories"
      ? "/v1/" + operation
      : "/v1/github/" +
        encodedRepo +
        "/" +
        operation +
        (operation === "workflow-source"
          ? "?" + new URLSearchParams({ path, ref })
          : "");
  async function send() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    setResult(null);
    setTransformed(null);
    const start = performance.now();
    try {
      if (
        !post &&
        !["health", "github/repositories"].includes(operation) &&
        !/^[-\w.]+\/[-\w.]+$/.test(repo)
      )
        throw Error("Use owner/repository");
      const body = post
        ? JSON.stringify(
            operation === "transform"
              ? { yaml, path: JSON.parse(nodePath), value }
              : { yaml },
          )
        : undefined;
      const response = await fetch(endpoint, {
        method: post ? "POST" : "GET",
        credentials: "same-origin",
        redirect: "error",
        signal: controller.signal,
        headers: post ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      const raw = await response.text();
      let formatted = raw;
      try {
        const data = JSON.parse(raw);
        formatted = JSON.stringify(data, null, 2);
        if (
          response.ok &&
          operation === "workflow-source" &&
          typeof data.yaml === "string"
        ) {
          const previous = await drafts.get(documentKey);
          const d = previous ?? {
            id: documentKey,
            repo,
            ref,
            path,
            yaml: data.yaml,
            original: data.yaml,
            updatedAt: Date.now(),
          };
          setOpened(d);
          setYaml(d.yaml);
          await drafts.save(d);
          setTab("ast");
        }
        if (
          response.ok &&
          operation === "transform" &&
          typeof data.yaml === "string"
        )
          setTransformed(data.yaml);
      } catch {}
      const headers: string[] = [];
      response.headers.forEach((v, k) => headers.push(k + ": " + v));
      setParsedSource(yaml);
      setResult({
        status: response.status,
        ms: Math.round(performance.now() - start),
        bytes: new TextEncoder().encode(raw).length,
        body: formatted,
        headers: headers.join("\n"),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      active.current = null;
      setBusy(false);
    }
  }
  useEffect(() => {
    const localId = new URLSearchParams(location.search).get("draft");
    if (localId && !autoLoaded.current) {
      autoLoaded.current = true;
      void drafts
        .get(localId)
        .then((d) => {
          if (d?.repo === "@local") switchDocument(d);
          else setDraftError("Local draft not found on this device");
        })
        .catch((e) => setDraftError(String(e)));
      return;
    }
    if (
      !autoLoaded.current &&
      (file || new URLSearchParams(location.search).has("path"))
    ) {
      autoLoaded.current = true;
      void send();
    }
  }, []);
  return (
    <section className={studio ? "lab orb-studio" : "lab"}>
      <div className="heading">
        <div>
          <p className="eyebrow">
            {studio ? "ORB / WORKSPACE" : "ORB / DEVELOPER TOOLS"}
          </p>
          <h1>{studio ? "Workflow Studio" : "API Lab"}</h1>
          <p>Open a repository workflow or work with your own YAML.</p>
        </div>
      </div>
      <LocalSourceTools
        source={yaml}
        filename={opened?.path ?? "workflow.yml"}
        disabled={busy || editBusy}
        onOpen={openLocal}
      />
      <div className="lab-tabs" aria-label="Open documents">
        {drafts.items.map((d) => (
          <span key={d.id} className="lab-document">
            <button
              disabled={busy || editBusy}
              aria-pressed={opened?.id === d.id}
              onClick={() => switchDocument(d)}
              title={d.repo + " @ " + d.ref + " / " + d.path}
            >
              {d.repo === "@local" ? "Local" : d.repo.split("/").at(-1)} /{" "}
              {d.path.split("/").at(-1)}
              {d.yaml !== d.original ? " •" : ""}
            </button>
            <button
              disabled={busy || editBusy}
              aria-label={"Close " + d.path}
              onClick={() => {
                if (
                  d.yaml !== d.original &&
                  !window.confirm("Discard local changes and close this draft?")
                )
                  return;
                void drafts
                  .remove(d.id)
                  .then(() => {
                    if (opened?.id === d.id) detach();
                  })
                  .catch((e) => setDraftError(String(e)));
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {(draftError || drafts.error) && (
        <p role="alert">{draftError || drafts.error}</p>
      )}
      {opened && (
        <small>
          {opened.repo} @ {opened.ref} ·{" "}
          {opened.yaml === opened.original ? "Original" : "Local draft"}
        </small>
      )}
      <div className="lab-layout">
        {!studio && (
          <aside className="lab-collection">
            <h3>
              <FolderGit2 size={15} /> Operations
            </h3>
            {operations.map((op) => (
              <button
                key={op}
                disabled={busy || (local && !parserOps.includes(op))}
                className={op === operation ? "lab-selected" : ""}
                onClick={() => setOperation(op)}
              >
                <small>{parserOps.includes(op) ? "POST" : "GET"}</small>
                {op}
              </button>
            ))}
          </aside>
        )}
        <div className="lab-workspace">
          <div className="lab-address">
            {studio ? (
              <span>
                {opened?.path ?? "Open a workflow from Explorer or import YAML"}
              </span>
            ) : (
              <>
                <code>{post ? "POST" : "GET"}</code>
                <code>{endpoint}</code>
              </>
            )}
            <button disabled={busy} onClick={send}>
              <Send size={14} /> {studio ? (local ? "Parse" : "Load") : "Send"}
            </button>
            {busy && (
              <button
                onClick={() => active.current?.abort()}
                aria-label="Cancel"
              >
                <Square size={14} />
              </button>
            )}
          </div>
          <div className="lab-columns">
            <section className="lab-panel">
              <h3>{studio ? "Source" : "Request"}</h3>
              {!local && (!studio || !opened) && (
                <>
                  <label>
                    Repository
                    <select
                      value={repo}
                      disabled={busy}
                      onChange={(e) => {
                        detach();
                        setRepo(e.target.value);
                      }}
                    >
                      {repos.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Ref
                    <input
                      value={ref}
                      disabled={busy}
                      onChange={(e) => {
                        detach();
                        setRef(e.target.value);
                      }}
                      autoCapitalize="none"
                    />
                  </label>
                  <label>
                    Workflow path
                    <input
                      value={path}
                      disabled={busy}
                      onChange={(e) => {
                        detach();
                        setPath(e.target.value);
                      }}
                      autoCapitalize="none"
                    />
                  </label>
                </>
              )}
              <label>
                YAML source
                <SourceEditor
                  key={opened?.id ?? "scratch"}
                  ref={editor}
                  value={yaml}
                  onChange={editYaml}
                  onCursor={setCursor}
                  diagnostics={
                    live && parsed.source === yaml
                      ? parsed.diagnostics
                      : undefined
                  }
                />
              </label>
              {operation === "transform" && (
                <>
                  <label>
                    AST path (JSON)
                    <input
                      value={nodePath}
                      onChange={(e) => setNodePath(e.target.value)}
                    />
                  </label>
                  <label>
                    Replacement
                    <input
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    />
                  </label>
                </>
              )}
            </section>
            <section className="lab-panel">
              <h3>
                {studio ? "Inspector" : "Response"}{" "}
                {result && (
                  <small>
                    {result.status} · {result.ms} ms · {result.bytes} B
                  </small>
                )}
              </h3>
              <div className="lab-tabs">
                {!studio && (
                  <>
                    <button onClick={() => setTab("body")}>Body</button>
                    <button onClick={() => setTab("headers")}>Headers</button>
                  </>
                )}
                <button
                  aria-pressed={tab === "ast"}
                  onClick={() => setTab("ast")}
                >
                  AST
                </button>
                <button
                  aria-pressed={tab === "graph"}
                  onClick={() => setTab("graph")}
                >
                  Graph
                </button>
                <label>
                  <input
                    type="checkbox"
                    checked={live}
                    onChange={(e) => setLive(e.target.checked)}
                  />{" "}
                  Live parse
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={sync}
                    onChange={(e) => setSync(e.target.checked)}
                  />{" "}
                  Sync AST
                </label>
                <button
                  disabled={!result || tab === "ast" || tab === "graph"}
                  onClick={() => {
                    if (result && tab !== "ast" && tab !== "graph")
                      void navigator.clipboard
                        .writeText(result[tab])
                        .catch(() => setError("Clipboard unavailable"));
                  }}
                >
                  <Copy size={13} />
                </button>
              </div>
              {proposal && (
                <div>
                  <PatchReview before={proposal.source} after={proposal.yaml} />
                  {proposal.source !== yaml && (
                    <p role="alert">
                      Source changed; discard and regenerate this patch.
                    </p>
                  )}
                  <button
                    disabled={proposal.source !== yaml}
                    onClick={() => {
                      editYaml(proposal.yaml);
                      setProposal(null);
                    }}
                  >
                    Apply YAML patch
                  </button>
                  <button onClick={() => setProposal(null)}>Discard</button>
                </div>
              )}
              {transformed !== null && transformed !== yaml && (
                <button onClick={() => editYaml(transformed)}>
                  Apply transformed YAML
                </button>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {tab === "ast" && live && (
                <div role="status">
                  <small>
                    {parsed.status} · {parsed.diagnostics.length} diagnostics
                  </small>
                  {parsed.error && <p className="error">{parsed.error}</p>}
                  {parsed.source === yaml &&
                    parsed.diagnostics.map((d, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (d.offset !== null)
                            editor.current?.select(
                              d.offset,
                              Math.min(d.offset + 1, yaml.length),
                            );
                        }}
                      >
                        {d.severity}: {d.message}
                      </button>
                    ))}
                </div>
              )}
              {tab === "graph" ? (
                <>
                  <BuilderForm
                    body={astBody}
                    disabled={astStale || editBusy || proposal !== null}
                    onEdit={editJob}
                  />
                  <WorkflowGraph
                    onEditNeeds={editNeeds}
                    body={astBody}
                    stale={astStale || editBusy || proposal !== null}
                    cursor={sync ? cursor : null}
                    onSelect={(path, from, to) => {
                      setNodePath(JSON.stringify(path));
                      if (sync) editor.current?.select(from, to);
                    }}
                  />
                </>
              ) : tab === "ast" ? (
                <AstExplorer
                  cursor={sync ? cursor : null}
                  body={astBody}
                  stale={astStale}
                  onSelect={(path, from, to) => {
                    setNodePath(JSON.stringify(path));
                    if (sync) editor.current?.select(from, to);
                  }}
                />
              ) : (
                <pre>
                  {busy
                    ? "Waiting for server…"
                    : (result?.[tab] ??
                      "Send a request to inspect the real response.")}
                </pre>
              )}
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
