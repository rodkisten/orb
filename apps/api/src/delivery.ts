import { deliverJardim, type JardimBindings } from "./jardim";
export async function processDelivery(
  db: D1Database,
  id: string,
  env: JardimBindings,
) {
  const event = await db
    .prepare("SELECT type,status FROM events WHERE id=?")
    .bind(id)
    .first<{ type: string; status: string }>();
  if (!event || event.status === "processed" || event.status === "failed")
    return;
  if (event.type !== "jardim.capture") return;
  if (env.JARDIM_CAPTURE_ENABLED !== "true")
    throw Error("Connector disabled; retained for recovery");
  const now = Date.now();
  await db
    .prepare(
      "INSERT OR IGNORE INTO connector_deliveries(event_id,connector,updated_at) VALUES(?,'jardim',?)",
    )
    .bind(id, now)
    .run();
  const claim = await db
    .prepare(
      "UPDATE connector_deliveries SET state='sending',attempts=attempts+1,updated_at=? WHERE event_id=? AND (state='pending' OR (state='sending' AND updated_at<?)) AND next_attempt_at<=?",
    )
    .bind(now, id, now - 60000, now)
    .run();
  if (!claim.meta.changes) throw Error("Delivery not ready");
  const row = await db
    .prepare("SELECT attempts FROM connector_deliveries WHERE event_id=?")
    .bind(id)
    .first<{ attempts: number }>();
  try {
    await deliverJardim(db, id, env);
    await db
      .prepare(
        "UPDATE connector_deliveries SET state='delivered',last_error=NULL,updated_at=? WHERE event_id=?",
      )
      .bind(Date.now(), id)
      .run();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Delivery failed";
    const attempts = row?.attempts ?? 1;
    const permanent =
      /^Jardim delivery failed: (400|409|413|422)$/.test(reason) ||
      attempts >= 8;
    await db.batch([
      db
        .prepare(
          "UPDATE connector_deliveries SET state=?,last_error=?,next_attempt_at=?,updated_at=? WHERE event_id=?",
        )
        .bind(
          permanent ? "failed" : "pending",
          /^Jardim delivery failed: [0-9]{3}$/.test(reason)
            ? reason
            : "Connector unavailable or invalid receipt",
          Date.now() + Math.min(3600000, 30000 * 2 ** attempts),
          Date.now(),
          id,
        ),
      db
        .prepare(
          "UPDATE events SET status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status!='processed'",
        )
        .bind(permanent ? "failed" : "queued", id),
    ]);
    throw Error("Connector delivery unsuccessful");
  }
}
export async function replayDelivery(db: D1Database, id: string) {
  await db.batch([
    db
      .prepare(
        "UPDATE events SET status='pending' WHERE id=? AND status='failed' AND EXISTS(SELECT 1 FROM connector_deliveries WHERE event_id=? AND state='failed')",
      )
      .bind(id, id),
    db
      .prepare(
        "UPDATE connector_deliveries SET state='pending',attempts=0,last_error=NULL,next_attempt_at=0,updated_at=? WHERE event_id=? AND state='failed'",
      )
      .bind(Date.now(), id),
  ]);
}
