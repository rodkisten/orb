import Dexie, { type Table } from "dexie";
import { create } from "zustand";
type Session = { id: string; value: unknown };
class SessionDatabase extends Dexie {
  sessions!: Table<Session, string>;
  constructor() {
    super("orb-session");
    this.version(1).stores({ sessions: "id" });
  }
}
export const sessionDB = new SessionDatabase();
type RouteState = Record<string, string | undefined>;
function readRoute(): RouteState {
  return Object.fromEntries(new URLSearchParams(location.search));
}
export const useRouteState = create<RouteState>(() => readRoute());
function sync() {
  useRouteState.setState(readRoute(), true);
}
window.addEventListener("popstate", sync);
export function updateRoute(patch: Record<string, string | null>) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  if (url.href !== location.href) {
    history.pushState(history.state, "", url);
    sync();
  }
}
const limit = 262144;
export async function encodeCode(source: string) {
  const bytes = new TextEncoder().encode(source);
  if (bytes.length > limit) throw Error("Snapshot exceeds size limit");
  const compressed = new Uint8Array(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );
  let binary = "";
  for (const byte of compressed) binary += String.fromCharCode(byte);
  return (
    "code=v1." +
    btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  );
}
export async function decodeCode(hash: string) {
  const encoded = new URLSearchParams(hash.replace(/^#/, "")).get("code");
  if (!encoded) return null;
  if (!encoded.startsWith("v1.") || encoded.length > limit * 2)
    throw Error("Invalid snapshot");
  const bytes = Uint8Array.from(
    atob(encoded.slice(3).replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
    .getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0,
    source = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw Error("Snapshot exceeds size limit");
      source += decoder.decode(value, { stream: true });
    }
    return source + decoder.decode();
  } finally {
    await reader.cancel();
  }
}
