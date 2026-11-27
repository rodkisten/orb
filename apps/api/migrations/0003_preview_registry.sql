CREATE TABLE IF NOT EXISTS preview_deployments (
  project TEXT NOT NULL,
  pr_number INTEGER NOT NULL CHECK (pr_number > 0),
  repository TEXT NOT NULL,
  hostname TEXT NOT NULL UNIQUE,
  sha TEXT NOT NULL CHECK (length(sha) = 40),
  status TEXT NOT NULL CHECK (status IN ('building','ready','failed','removed')),
  upstream TEXT,
  run_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project, pr_number),
  CHECK (status <> 'ready' OR upstream IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS preview_deployments_updated ON preview_deployments(updated_at DESC);
