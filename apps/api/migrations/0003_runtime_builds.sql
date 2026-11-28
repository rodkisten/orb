CREATE TABLE IF NOT EXISTS runtime_builds (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 target_id TEXT NOT NULL,
 request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 actor TEXT NOT NULL,
 target_json TEXT NOT NULL,
 source_sha TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('dispatching','accepted','running','succeeded','failed','dispatch_unknown')),
 run_id INTEGER,
 error TEXT,
 result_json TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(workspace_id,target_id,request_key)
);
CREATE INDEX IF NOT EXISTS runtime_builds_workspace ON runtime_builds(workspace_id,target_id,created_at DESC);
