CREATE TABLE IF NOT EXISTS connector_deliveries (
 event_id TEXT PRIMARY KEY REFERENCES events(id), connector TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'pending',
 last_error TEXT, next_attempt_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS connector_delivery_state ON connector_deliveries(state,next_attempt_at);
