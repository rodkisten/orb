CREATE TABLE IF NOT EXISTS github_cache (key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS github_cache_expiry ON github_cache(expires_at);
