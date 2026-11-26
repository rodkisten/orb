export type JardimBindings = {
  JARDIM_CAPTURE_TOKEN?: string;
  JARDIM_CAPTURE_ENABLED?: string;
};
type Record = {
  id: string;
  type: string;
  occurred_at: string;
  payload_json: string;
  status: string;
};
export async function deliverJardim(
  db: D1Database,
  id: string,
  env: JardimBindings,
  fetcher = fetch,
) {
  if (env.JARDIM_CAPTURE_ENABLED !== "true")
    throw Error("Jardim connector disabled");
  const row = await db
    .prepare(
      "SELECT id,type,occurred_at,payload_json,status FROM events WHERE id=?",
    )
    .bind(id)
    .first<Record>();
  if (!row || row.status === "processed" || row.type !== "jardim.capture")
    return;
  if (!env.JARDIM_CAPTURE_TOKEN) throw Error("Jardim token missing");
  const payload = JSON.parse(row.payload_json) as {
    kind?: string;
    title?: string;
    url?: string;
  };
  const bytes = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode("orb:jardim:" + row.id),
    ),
  ).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 128;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  const uuid = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
  const response = await fetcher("https://jardim.migos.club/v2/inbox/events", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: {
      authorization: "Bearer " + env.JARDIM_CAPTURE_TOKEN,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      version: 1,
      id: uuid,
      source: "orb",
      kind: payload.kind,
      title: payload.title,
      url: payload.url,
      observedAt: row.occurred_at,
    }),
  });
  if (!response.ok) throw Error("Jardim delivery failed: " + response.status);
  const receipt = (await response.json()) as { acknowledged?: string[] };
  if (!receipt.acknowledged?.includes(uuid))
    throw Error("Jardim receipt missing");
}
