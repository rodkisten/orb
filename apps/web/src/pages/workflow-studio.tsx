import { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

type Repo = { nameWithOwner: string; defaultBranchRef: { name: string } | null };
type Workflow = { id: number; name: string; path: string };
type Validation = { valid: boolean; jobs: { id: string; needs: string[] }[]; diagnostics: { severity: string; message: string }[] };
async function request<T>(url: string, signal?: AbortSignal, yaml?: string): Promise<T> {
  const response = await fetch(url, { signal, credentials: "same-origin", ...(yaml === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yaml }) }) });
  if (!response.ok) throw Error("Request failed: " + response.status);
  return response.json() as Promise<T>;
}
const endpoint = (repo: string) => "/v1/github/" + repo.split("/").map(encodeURIComponent).join("/");
async function workflows(repo: string, signal: AbortSignal) {
  const result: Workflow[] = [];
  for (let page = 1; page <= 100; page++) {
    const response = await request<{ data: { workflows: Workflow[] }; hasNext: boolean }>(endpoint(repo) + "/actions/workflows?" + new URLSearchParams({ page: String(page), limit: "100" }), signal);
    result.push(...response.data.workflows);
    if (!response.hasNext) return result;
  }
  throw Error("Workflow pagination limit exceeded");
}
export function WorkflowStudio() {
  const search = useSearch({ from: "/workflows" });
  const navigate = useNavigate({ from: "/workflows" });
  const [yaml, setYaml] = useState("");
  const [filename, setFilename] = useState("workflow.yml");
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<Validation | null>(null);
  const [busy, setBusy] = useState(false);
  const repositories = useQuery({ queryKey: ["studio-repositories"], queryFn: ({ signal }) => request<{ repositories: Repo[] }>("/v1/github/repositories", signal) });
  const selected = (repositories.data?.repositories ?? []).filter(r => search.context === "all" || search.context.split(",").includes(r.nameWithOwner));
  const queries = useQueries({ queries: selected.map(r => ({ queryKey: ["studio-workflows", r.nameWithOwner], queryFn: ({ signal }: { signal: AbortSignal }) => workflows(r.nameWithOwner, signal) })) });
  function edit(value: string) { setYaml(value); setValidation(null); }
  async function load(repo: Repo, workflow: Workflow) {
    setBusy(true); setError("");
    try {
      const data = await request<{ yaml: string }>(endpoint(repo.nameWithOwner) + "/workflow-source?" + new URLSearchParams({ path: workflow.path, ref: repo.defaultBranchRef?.name ?? "main" }));
      edit(data.yaml); setFilename(workflow.path.split("/").pop() ?? "workflow.yml");
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function validate() {
    setBusy(true); setError("");
    try { setValidation(await request<Validation>("/v1/workflows/validate", undefined, yaml)); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  return <section className="lab">
    <p className="eyebrow">ORB / AUTOMATION</p><h1>Workflow Studio</h1>
    <div className="lab-layout">
      <aside className="lab-collection">
        <h3>Repository context</h3>
        <button onClick={() => void navigate({ search: { context: "all" } })}>All repositories</button>
        {repositories.isError && <p role="alert">{String(repositories.error)}</p>}
        {repositories.data?.repositories.map(r => <label key={r.nameWithOwner} className="flex items-center gap-2"><input type="checkbox" checked={selected.some(s => s.nameWithOwner === r.nameWithOwner)} onChange={e => { const names = selected.map(s => s.nameWithOwner).filter(n => n !== r.nameWithOwner); if (e.target.checked) names.push(r.nameWithOwner); void navigate({ search: { context: names.join(",") } }); }} />{r.nameWithOwner}</label>)}
        {selected.map((r, i) => <div key={r.nameWithOwner}><h3>{r.nameWithOwner}</h3>{queries[i]?.isPending && <p>Loading…</p>}{queries[i]?.isError && <p role="alert">{String(queries[i].error)}</p>}{queries[i]?.data?.map(w => <button key={w.id} disabled={busy} onClick={() => void load(r, w)}>{w.name}</button>)}</div>)}
      </aside>
      <div className="lab-workspace"><div className="lab-panel">
        <h3>{filename}</h3>
        <label>Import YAML<input type="file" accept=".yml,.yaml,text/yaml" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 262144) { setError("File exceeds 256 KiB"); return; } try { edit(await file.text()); setFilename(file.name); setError(""); } catch (err) { setError(String(err)); } }} /></label>
        <textarea rows={22} value={yaml} disabled={busy} onChange={e => edit(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Paste YAML or import a workflow" />
        <div className="lab-tabs"><button disabled={busy || !yaml.trim()} onClick={() => void validate()}>Validate & inspect jobs</button><button disabled={!yaml} onClick={() => { const url = URL.createObjectURL(new Blob([yaml], { type: "text/yaml" })); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Export YAML</button></div>
        {error && <p role="alert">{error}</p>}
        {validation && <div><h3>{validation.valid ? "Valid workflow" : "Validation failed"}</h3>{validation.diagnostics.map((d,i) => <p key={i}>{d.severity}: {d.message}</p>)}{validation.jobs.map(j => <div key={j.id} className="rounded border p-2 my-2"><strong>{j.id}</strong><p>{j.needs.length ? "Depends on: " + j.needs.join(", ") : "Entry job"}</p></div>)}</div>}
      </div></div>
    </div>
  </section>;
}
