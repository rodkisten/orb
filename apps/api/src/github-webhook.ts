import type { OrbEvent } from './events'
import { markQueued, persistEvent } from './storage'

type WebhookBindings = {
  ORB_DB: D1Database
  ORB_EVENTS: Queue<{ eventId: string }>
  ORB_WEBHOOK_SECRET?: string
}

const encoder = new TextEncoder()
const MAX_BODY_BYTES = 1024 * 1024

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function verifyGitHubSignature(
  body: ArrayBuffer,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!/^sha256=[a-f0-9]{64}$/.test(signature ?? '') || !secret) return false
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, body))
  const expected = 'sha256=' + hex(digest)
  // Constant-time comparison for a fixed-length, normalized signature.
  let difference = 0
  for (let i = 0; i < expected.length; i++) {
    difference |= expected.charCodeAt(i) ^ (signature?.charCodeAt(i) ?? 0)
  }
  return difference === 0
}

export async function handleGitHubWebhook(
  request: Request,
  env: WebhookBindings,
): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })
  if (!env.ORB_WEBHOOK_SECRET) return Response.json({ error: 'Webhook not configured' }, { status: 503 })

  const length = Number(request.headers.get('content-length') ?? '0')
  if (length > MAX_BODY_BYTES) return Response.json({ error: 'Payload too large' }, { status: 413 })
  const body = await request.arrayBuffer()
  if (body.byteLength > MAX_BODY_BYTES) return Response.json({ error: 'Payload too large' }, { status: 413 })

  if (!(await verifyGitHubSignature(body, request.headers.get('x-hub-signature-256'), env.ORB_WEBHOOK_SECRET))) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const delivery = request.headers.get('x-github-delivery')
  const type = request.headers.get('x-github-event')
  if (!delivery || !/^[a-zA-Z0-9-]{1,128}$/.test(delivery) || !type || !/^[a-z_]{1,64}$/.test(type)) {
    return Response.json({ error: 'Invalid GitHub headers' }, { status: 400 })
  }

  let payload: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(body))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid payload')
    payload = parsed as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const repository = payload.repository
  const repoName = repository && typeof repository === 'object' && 'full_name' in repository
    ? String(repository.full_name) : 'unknown'
  const now = new Date().toISOString()
  const event: OrbEvent = {
    id: 'github:' + delivery,
    source: 'github',
    type,
    subjectId: repoName,
    externalId: delivery,
    occurredAt: now,
    observedAt: now,
    schemaVersion: 1,
    payload,
  }
  const { record, created } = await persistEvent(env.ORB_DB, event)
  if (record.status === 'pending') {
    try {
      await env.ORB_EVENTS.send({ eventId: record.id })
      await markQueued(env.ORB_DB, record.id)
    } catch {
      return Response.json({ error: 'Event stored for retry', id: record.id }, { status: 503 })
    }
  }
  return Response.json({ id: record.id, created }, { status: created ? 202 : 200 })
}
