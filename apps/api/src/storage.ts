import type { OrbEvent } from './events'
import { dedupeKey } from './events'

export type EventRecord = {
  id: string
  status: 'pending' | 'queued' | 'processed' | 'failed'
}

export async function persistEvent(db: D1Database, event: OrbEvent): Promise<{
  record: EventRecord
  created: boolean
}> {
  const result = await db.prepare(
    `INSERT OR IGNORE INTO events
      (id, dedupe_key, type, source, subject_id, external_id, correlation_id,
       occurred_at, observed_at, schema_version, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    event.id, dedupeKey(event), event.type, event.source, event.subjectId,
    event.externalId ?? null, event.correlationId ?? null,
    event.occurredAt, event.observedAt, event.schemaVersion,
    JSON.stringify(event.payload),
  ).run()

  const record = await db.prepare(
    'SELECT id, status FROM events WHERE dedupe_key = ? OR id = ? LIMIT 1'
  ).bind(dedupeKey(event), event.id).first<EventRecord>()

  if (!record) throw new Error('Event could not be read after insertion')
  return { record, created: (result.meta.changes ?? 0) > 0 }
}

export async function markQueued(db: D1Database, id: string): Promise<void> {
  await db.prepare(
    "UPDATE events SET status = 'queued', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending'"
  ).bind(id).run()
}

export async function markProcessed(db: D1Database, id: string): Promise<void> {
  await db.prepare(
    "UPDATE events SET status = 'processed', attempts = attempts + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status != 'processed'"
  ).bind(id).run()
}
