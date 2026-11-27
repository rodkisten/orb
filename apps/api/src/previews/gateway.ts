import { findPreview } from "./registry";

type Bindings = { ORB_DB: D1Database };

function statusPage(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const url = new URL(request.url);
    const match = /^sandbox-pr([1-9][0-9]{0,8})\.migos\.club$/.exec(url.hostname);
    if (!match) return statusPage(404, "Unknown preview hostname");
    if (request.method !== "GET" && request.method !== "HEAD") return statusPage(405, "Preview gateway is read-only");
    if (url.pathname === "/api" || url.pathname.startsWith("/api/") || url.pathname === "/ws" || url.pathname.startsWith("/ws/")) return statusPage(403, "Preview API is not exposed by this gateway");
    const preview = await findPreview(env.ORB_DB, url.hostname);
    if (!preview || preview.status === "removed") return statusPage(404, "Preview not available");
    if (preview.status !== "ready") return statusPage(503, "Preview " + preview.status);
    const origin = "https://pr" + match[1] + ".sandbox.migos.club";
    if (preview.upstream !== origin) return statusPage(502, "Invalid preview target");
    const target = new URL(origin);
    target.pathname = url.pathname;
    target.search = url.search;
    const headers = new Headers();
    for (const name of ["accept", "accept-language", "range", "if-none-match", "if-modified-since"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    try {
      const response = await fetch(target, { method: request.method, headers, redirect: "manual" });
      if (response.status >= 300 && response.status < 400 && response.status !== 304) return statusPage(502, "Upstream redirect blocked");
      const outgoing = new Headers(response.headers);
      outgoing.delete("set-cookie");
      outgoing.set("cache-control", "no-store");
      return new Response(response.body, { status: response.status, headers: outgoing });
    } catch {
      return statusPage(502, "Preview upstream unavailable");
    }
  },
};
