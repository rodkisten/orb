CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  external_id TEXT,
  correlation_id TEXT,
  occurred_at TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'processed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS events_status_created_idx ON events(status, created_at);
CREATE INDEX IF NOT EXISTS events_source_occurred_idx ON events(source, occurred_at);
CREATE INDEX IF NOT EXISTS events_correlation_idx ON events(correlation_id);
