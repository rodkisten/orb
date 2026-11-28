import api from "./index";
export default {
  async fetch(...args: Parameters<typeof api.fetch>) {
    const request = args[0];
    const path = new URL(request.url).pathname;
    const read =
      request.method === "GET" &&
      (path === "/v1/health" ||
        path === "/v1/meta" ||
        path === "/v1/session" ||
        path.startsWith("/v1/github/") ||
        path.startsWith("/v1/actions/"));
    const parse =
      request.method === "POST" &&
      /^\/v1\/workflows\/(parse|validate|inspect|transform|edit-needs|edit)$/.test(
        path,
      );
    if (!read && !parse)
      return new Response("Preview operation disabled", { status: 403 });
    return api.fetch(...args);
  },
};
