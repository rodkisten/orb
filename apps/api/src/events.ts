import { t } from "elysia";

export const eventSchema = t.Object({
  id: t.String({ minLength: 1, maxLength: 256 }),
  type: t.String({ minLength: 1, maxLength: 256 }),
  source: t.String({ minLength: 1, maxLength: 256 }),
  subjectId: t.String({ minLength: 1, maxLength: 512 }),
  occurredAt: t.String({ format: "date-time" }),
  observedAt: t.String({ format: "date-time" }),
  schemaVersion: t.Integer({ minimum: 1 }),
  externalId: t.Optional(t.String({ maxLength: 512 })),
  correlationId: t.Optional(t.String({ maxLength: 512 })),
  payload: t.Record(t.String(), t.Unknown()),
});

export type OrbEvent = typeof eventSchema.static;

export function dedupeKey(event: OrbEvent): string {
  // External IDs are stable across backfills and replay. Otherwise the
  // producer-supplied event ID is the idempotency boundary.
  return JSON.stringify([
    event.source,
    event.type,
    event.externalId ?? event.id,
  ]);
}

export function authorized(
  authorization: string | null,
  token: string,
): boolean {
  if (!authorization?.startsWith("Bearer ") || !token) return false;
  const candidate = authorization.slice(7);
  const a = new TextEncoder().encode(candidate);
  const b = new TextEncoder().encode(token);
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let i = 0; i < length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}
