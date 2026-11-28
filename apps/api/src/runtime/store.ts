import {
  buildResultSchema,
  buildTargetSchema,
  type BuildRequest,
  type BuildTarget,
  type PublicBuild,
  type BuildResult,
} from "@rodverse/runtime-contracts";
export interface BuildRecord {
  id: string;
  workspaceId: string;
  targetId: string;
  requestHash: string;
  actor: string;
  target: BuildTarget;
  sourceSha: string;
  status: PublicBuild["status"];
  runId: number | null;
  error: string | null;
  result: BuildResult | null;
  createdAt: string;
  updatedAt: string;
}
export interface BuildStore {
  reserve(
    request: BuildRequest,
    actor: string,
    target: BuildTarget,
    hash: string,
  ): Promise<{ record: BuildRecord; created: boolean }>;
  get(id: string): Promise<BuildRecord | null>;
  update(
    id: string,
    fields: Partial<Pick<BuildRecord, "status" | "runId" | "error" | "result">>,
  ): Promise<BuildRecord>;
  list(workspace: string, target: string): Promise<BuildRecord[]>;
}
type Row = {
  id: string;
  workspace_id: string;
  target_id: string;
  request_hash: string;
  actor: string;
  target_json: string;
  source_sha: string;
  status: BuildRecord["status"];
  run_id: number | null;
  error: string | null;
  result_json: string | null;
  created_at: string;
  updated_at: string;
};
function record(row: Row): BuildRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    targetId: row.target_id,
    requestHash: row.request_hash,
    actor: row.actor,
    target: buildTargetSchema.parse(JSON.parse(row.target_json)),
    sourceSha: row.source_sha,
    status: row.status,
    runId: row.run_id,
    error: row.error,
    result: row.result_json
      ? buildResultSchema.parse(JSON.parse(row.result_json))
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export class D1BuildStore implements BuildStore {
  private db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }
  async reserve(
    request: BuildRequest,
    actor: string,
    target: BuildTarget,
    hash: string,
  ) {
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    const result = await this.db
      .prepare(
        "INSERT OR IGNORE INTO runtime_builds(id,workspace_id,target_id,request_key,request_hash,actor,target_json,source_sha,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'dispatching',?,?)",
      )
      .bind(
        id,
        request.workspaceId,
        request.targetId,
        request.idempotencyKey,
        hash,
        actor,
        JSON.stringify(target),
        request.sourceSha,
        now,
        now,
      )
      .run();
    const row = await this.db
      .prepare(
        "SELECT * FROM runtime_builds WHERE workspace_id=? AND target_id=? AND request_key=?",
      )
      .bind(request.workspaceId, request.targetId, request.idempotencyKey)
      .first<Row>();
    if (!row) throw Error("Build reservation unavailable");
    return { record: record(row), created: (result.meta.changes ?? 0) > 0 };
  }
  async get(id: string) {
    const row = await this.db
      .prepare("SELECT * FROM runtime_builds WHERE id=?")
      .bind(id)
      .first<Row>();
    return row ? record(row) : null;
  }
  async update(
    id: string,
    fields: Partial<Pick<BuildRecord, "status" | "runId" | "error" | "result">>,
  ) {
    const columns = {
      status: "status",
      runId: "run_id",
      error: "error",
      result: "result_json",
    } as const;
    const entries = Object.entries(fields) as [keyof typeof columns, unknown][];
    if (entries.length)
      await this.db
        .prepare(
          "UPDATE runtime_builds SET " +
            entries.map(([key]) => columns[key] + "=?").join(",") +
            ",updated_at=? WHERE id=?",
        )
        .bind(
          ...entries.map(([key, value]) =>
            key === "result" && value !== null
              ? JSON.stringify(value)
              : (value as string | number | null),
          ),
          new Date().toISOString(),
          id,
        )
        .run();
    const next = await this.get(id);
    if (!next) throw Error("Build record unavailable");
    return next;
  }
  async list(workspace: string, target: string) {
    const result = await this.db
      .prepare(
        "SELECT * FROM runtime_builds WHERE workspace_id=? AND target_id=? ORDER BY created_at DESC LIMIT 30",
      )
      .bind(workspace, target)
      .all<Row>();
    return result.results.map(record);
  }
}
