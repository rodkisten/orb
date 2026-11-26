import { useMemo, useState } from "react";
type Node = {
  path: (string | number)[];
  kind: string;
  range: { from: number; to: number } | null;
};
function readNodes(body: string): Node[] {
  try {
    const data = JSON.parse(body);
    if (!Array.isArray(data.nodes)) return [];
    return data.nodes.filter(
      (n: Node) =>
        Array.isArray(n.path) &&
        typeof n.kind === "string" &&
        n.range &&
        Number.isInteger(n.range.from) &&
        Number.isInteger(n.range.to),
    );
  } catch {
    return [];
  }
}
export function AstExplorer({
  body,
  stale,
  onSelect,
}: {
  body: string;
  stale: boolean;
  onSelect: (path: Node["path"], from: number, to: number) => void;
}) {
  const nodes = useMemo(() => readNodes(body), [body]);
  const [filter, setFilter] = useState("");
  const [limit, setLimit] = useState(100);
  const filtered = useMemo(
    () =>
      nodes.filter((n) =>
        n.path.join(".").toLowerCase().includes(filter.toLowerCase()),
      ),
    [nodes, filter],
  );
  return (
    <div className="lab-ast">
      <label>
        Filter AST
        <input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setLimit(100);
          }}
          placeholder="jobs.build.steps"
          autoCapitalize="none"
        />
      </label>
      <small>
        {filtered.length} / {nodes.length} nodes
      </small>
      {stale && (
        <p className="error">
          Source changed. Parse again to synchronize ranges.
        </p>
      )}
      {!nodes.length && <p>Run the parse operation to inspect source nodes.</p>}
      <div className="lab-ast-list">
        {filtered.slice(0, limit).map((n) => (
          <button
            key={JSON.stringify(n.path)}
            disabled={stale}
            onClick={() => {
              if (n.range) onSelect(n.path, n.range.from, n.range.to);
            }}
            style={{ paddingInlineStart: 8 + Math.min(n.path.length, 8) * 8 }}
          >
            <code>{n.path.at(-1) ?? "root"}</code>
            <small>
              {n.kind} · {n.range?.from}:{n.range?.to}
            </small>
          </button>
        ))}
      </div>
      {filtered.length > limit && (
        <button onClick={() => setLimit((v) => v + 100)}>Show more</button>
      )}
    </div>
  );
}
