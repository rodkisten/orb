import { useState, useMemo } from "react";
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
  const [confirmedSha, setConfirmedSha] = useState("");
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
  const model = useMemo(
    () => (source.data ? inspectWorkflow(source.data.yaml) : null),
    [source.data],
  );
  const tags = useQuery({
    queryKey: ["dispatch-tags", target.repo],
    queryFn: ({ signal }) =>
      read<{ data: { name: string }[]; hasNext: boolean }>(
        base + "/tags?limit=100",
        signal,
      ),
  });
  const environments = useQuery({
    queryKey: ["dispatch-environments", target.repo],
    enabled:
      !!model &&
      Object.values(model.dispatchSchema ?? {}).some(
        (p) => (p as Port)?.type === "environment",
      ),
    queryFn: ({ signal }) =>
      read<{ data: { environments: { name: string }[] }; hasNext: boolean }>(
        base + "/environments?limit=100",
        signal,
      ),
    retry: false,
  });
  const envNames = environments.data?.data.environments ?? [];
  const ports = Object.entries(
    (model?.dispatchSchema ?? {}) as Record<string, Port>,
  );
  const valid =
    !!model?.valid && model.triggerNames.includes("workflow_dispatch");
  const raw = branches.data as
    { data?: { name: string }[]; hasNext?: boolean } | undefined;
  const names = raw?.data ?? [];
  const tagNames = tags.data?.data ?? [];
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
    if (
      !production ||
      !confirmed ||
      busy ||
      !source.data ||
      confirmedSha !== source.data.sha ||
      !valid ||
      invalid ||
      source.isFetching ||
      !!source.error
    )
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
          return v === undefined ||
            (v === "" &&
              ["boolean", "number", "choice", "environment"].includes(
                p.type ?? "",
              ))
            ? []
            : [[k, v]];
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
        {(names.length > 0 || tagNames.length > 0) && (
          <select
            aria-label="Choose branch"
            value=""
            onChange={(e) => changeRef(e.target.value)}
          >
            <option value="">Choose branch</option>
            <optgroup label="Branches">
              {names.map((n) => (
                <option key={n.name} value={n.name}>
                  {n.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Tags">
              {tagNames.map((n) => (
                <option key={n.name} value={n.name}>
                  {n.name}
                </option>
              ))}
            </optgroup>
          </select>
        )}
        {(raw?.hasNext || tags.data?.hasNext) && (
          <small>First 100 refs shown; enter other refs manually.</small>
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
              ) : p.type === "environment" &&
                envNames.length > 0 &&
                !environments.data?.hasNext ? (
                <select
                  value={values[k] ?? String(p.default ?? "")}
                  onChange={(e) => change(k, e.target.value)}
                >
                  <option value="">Select environment</option>
                  {envNames.map((n) => (
                    <option key={n.name}>{n.name}</option>
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
        {environments.error && (
          <small>Environment lookup unavailable; enter name manually.</small>
        )}
        {environments.data?.hasNext && (
          <small>Environment list incomplete; enter name manually.</small>
        )}
        {valid && (
          <small>
            Published blob: {source.data?.sha.slice(0, 12)} · local edits are
            not executed.
          </small>
        )}
        <label>
          <input
            type="checkbox"
            checked={confirmed && confirmedSha === source.data?.sha}
            disabled={!production || !valid || invalid || source.isFetching}
            onChange={(e) => {
              setConfirmed(e.target.checked);
              setConfirmedSha(source.data?.sha ?? "");
            }}
          />{" "}
          Confirm execution on {ref}
        </label>
        <Button
          type="button"
          disabled={
            !production ||
            !confirmed ||
            confirmedSha !== source.data?.sha ||
            !!source.error ||
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
