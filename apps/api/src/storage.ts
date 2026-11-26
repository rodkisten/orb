import type { OrbEvent } from "./events";
import { dedupeKey } from "./events";

export type EventRecord = {
  id: string;
  status: "pending" | "queued" | "processed" | "failed";
};

export async function persistEvent(
  db: D1Database,
  event: OrbEvent,
): Promise<{
  record: EventRecord;
  created: boolean;
}> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO events
      (id, dedupe_key, type, source, subject_id, external_id, correlation_id,
       occurred_at, observed_at, schema_version, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      event.id,
      dedupeKey(event),
      event.type,
      event.source,
      event.subjectId,
      event.externalId ?? null,
      event.correlationId ?? null,
      event.occurredAt,
      event.observedAt,
      event.schemaVersion,
      JSON.stringify(event.payload),
    )
    .run();

  const record = await db
    .prepare(
      "SELECT id, status FROM events WHERE dedupe_key = ? OR id = ? LIMIT 1",
    )
    .bind(dedupeKey(event), event.id)
    .first<EventRecord>();

  if (!record) throw new Error("Event could not be read after insertion");
  return { record, created: (result.meta.changes ?? 0) > 0 };
}

export async function markQueued(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(
      "UPDATE events SET status = 'queued', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending'",
    )
    .bind(id)
    .run();
}

export async function markReceived(db: D1Database, id: string): Promise<void> {
  // 'processed' currently means queue delivery was durably acknowledged.
  // Connector-specific business processing is not yet implemented.
  await db
    .prepare(
      "UPDATE events SET status = 'processed', attempts = attempts + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status IN ('pending','queued')",
    )
    .bind(id)
    .run();
}

export async function recoverOutbox(
  db: D1Database,
  queue: Queue<{ eventId: string }>,
  limit = 50,
): Promise<{ scanned: number; enqueued: number; failed: number }> {
  // Re-dispatch pending records and stale queued records. This is at-least-once
  // delivery: downstream handlers MUST be idempotent.
  const rows = await db
    .prepare(
      `SELECT id FROM events
     WHERE (status = 'pending'
        OR (status = 'queued' AND updated_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-10 minutes')))
        AND NOT EXISTS(SELECT 1 FROM connector_deliveries d WHERE d.event_id=events.id AND d.next_attempt_at > unixepoch('now')*1000)
     ORDER BY created_at ASC LIMIT ?`,
    )
    .bind(limit)
    .all<{ id: string }>();

  let enqueued = 0;
  let failed = 0;
  for (const row of rows.results) {
    try {
      await queue.send({ eventId: row.id });
      await db
        .prepare(
          "UPDATE events SET status = 'queued', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status != 'processed'",
        )
        .bind(row.id)
        .run();
      enqueued++;
    } catch {
      failed++;
    }
  }
  return { scanned: rows.results.length, enqueued, failed };
}
