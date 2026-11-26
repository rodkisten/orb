import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { inspectWorkflow } from "@orb/workflow-core";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Play, RefreshCw } from "lucide-react";
export type DispatchTarget = { repo: string; ref: string; path: string };
type Port = {
  type?: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  options?: string[];
};
async function read<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    signal,
    credentials: "same-origin",
    redirect: "error",
    cache: "no-store",
  });
  if (!res.ok) throw Error("GitHub lookup failed (" + res.status + ")");
  return res.json() as Promise<T>;
}
export function DispatchRunner({ target }: { target: DispatchTarget }) {
  const [ref, setRef] = useState(target.ref);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [runs, setRuns] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const base =
    "/v1/github/" + target.repo.split("/").map(encodeURIComponent).join("/");
  const production = location.origin === "https://orb.migos.club";
  const branches = useQuery({
    queryKey: ["dispatch-branches", target.repo],
    queryFn: ({ signal }) =>
      read<unknown>(base + "/branches?limit=100", signal),
  });
  const source = useQuery({
    queryKey: ["dispatch-source", target.repo, target.path, ref],
    enabled: !!ref.trim(),
    queryFn: ({ signal }) =>
      read<{ yaml: string; sha: string }>(
        base +
          "/workflow-source?" +
          new URLSearchParams({ path: target.path, ref }),
        signal,
      ),
    staleTime: 0,
    retry: false,
  });
  const model = source.data ? inspectWorkflow(source.data.yaml) : null;
  const ports = Object.entries(
    (model?.dispatchSchema ?? {}) as Record<string, Port>,
  );
  const valid =
    !!model?.valid && model.triggerNames.includes("workflow_dispatch");
  const raw = branches.data as
    { items?: { name: string }[]; branches?: { name: string }[] } | undefined;
  const names = Array.isArray(raw) ? raw : (raw?.items ?? raw?.branches ?? []);
  function changeRef(v: string) {
    setRef(v);
    setValues({});
    setConfirmed(false);
    setMessage("");
    setRuns("");
  }
  function change(k: string, v: string) {
    setValues((s) => ({ ...s, [k]: v }));
    setConfirmed(false);
  }
  const invalid = ports.some(([k, p]) => {
    const v = values[k] ?? String(p.default ?? "");
    return (
      (!!p.required && !v.trim()) ||
      (!!v &&
        ((p.type === "number" && !Number.isFinite(Number(v))) ||
          (p.type === "boolean" && !["true", "false"].includes(v)) ||
          (p.type === "choice" && !p.options?.includes(v))))
    );
  });
  async function dispatch() {
    if (!production || !confirmed || busy || !source.data || !valid || invalid)
      return;
    setBusy(true);
    setConfirmed(false);
    setMessage("");
    setRuns("");
    try {
      const inputs = Object.fromEntries(
        ports.flatMap(([k, p]) => {
          const v =
            values[k] ??
            (p.default === undefined ? undefined : String(p.default));
          return v === undefined ? [] : [[k, v]];
        }),
      );
      const res = await fetch(base + "/actions/dispatch", {
        method: "POST",
        credentials: "same-origin",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: target.path,
          ref,
          sha: source.data.sha,
          inputs,
        }),
      });
      const data = (await res.json()) as {
        accepted?: boolean;
        error?: string;
        runsUrl?: string;
      };
      if (!res.ok || !data.accepted)
        throw Error(data.error ?? "Dispatch not confirmed");
      setMessage(
        "GitHub accepted the dispatch. Check runs for execution status.",
      );
      if (
        data.runsUrl?.startsWith(
          "https://github.com/" + target.repo + "/actions/workflows/",
        )
      )
        setRuns(data.runsUrl);
    } catch (e) {
      setMessage(String(e) + " · Check GitHub before retrying.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="orb-expression rounded-xl border border-border p-3">
      <h3>
        <Play size={16} /> Run published workflow
      </h3>
      <small>
        {target.repo} · {target.path}
      </small>
      {!production && <p>Preview mode: execution disabled.</p>}
      <fieldset disabled={busy}>
        <label>
          Branch or tag
          <Input
            value={ref}
            onChange={(e) => changeRef(e.target.value)}
            autoCapitalize="none"
          />
        </label>
        {names.length > 0 && (
          <select
            aria-label="Choose branch"
            value=""
            onChange={(e) => changeRef(e.target.value)}
          >
            <option value="">Choose branch</option>
            {names.map((n: { name: string }) => (
              <option key={n.name}>{n.name}</option>
            ))}
          </select>
        )}
        <Button
          type="button"
          onClick={() => {
            setConfirmed(false);
            void source.refetch();
          }}
        >
          <RefreshCw size={14} /> Reload published schema
        </Button>
        {source.isFetching && <p>Loading published workflow…</p>}
        {source.error && <p role="alert">{String(source.error)}</p>}
        {source.data && !valid && (
          <p>No valid workflow_dispatch on this ref.</p>
        )}
        {valid &&
          ports.map(([k, p]) => (
            <label key={k}>
              {k}
              {p.required ? " *" : ""}
              <small>{p.description}</small>
              {p.type === "boolean" || p.type === "choice" ? (
                <select
                  value={values[k] ?? String(p.default ?? "")}
                  onChange={(e) => change(k, e.target.value)}
                >
                  <option value="">Select</option>
                  {(p.type === "boolean"
                    ? ["true", "false"]
                    : (p.options ?? [])
                  ).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <Input
                  type={p.type === "number" ? "number" : "text"}
                  value={values[k] ?? String(p.default ?? "")}
                  onChange={(e) => change(k, e.target.value)}
                />
              )}
            </label>
          ))}
        {valid && (
          <small>
            Published blob: {source.data?.sha.slice(0, 12)} · local edits are
            not executed.
          </small>
        )}
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            disabled={!production || !valid || invalid || source.isFetching}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          Confirm execution on {ref}
        </label>
        <Button
          type="button"
          disabled={
            !production ||
            !confirmed ||
            !valid ||
            invalid ||
            busy ||
            source.isFetching
          }
          onClick={() => void dispatch()}
        >
          <Play size={14} />
          {busy ? "Dispatching…" : "Run workflow"}
        </Button>
      </fieldset>
      {message && <p role="status">{message}</p>}
      {runs && (
        <a href={runs} target="_blank" rel="noreferrer">
          Open workflow runs
        </a>
      )}
    </section>
  );
}
