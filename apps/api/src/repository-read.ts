import { githubToken, type GitHubCredentials } from "./github-auth";

type Environment = GitHubCredentials & { ORB_CI_REPOSITORIES?: string };
type Resource =
  | "contents"
  | "branches"
  | "pulls"
  | "commits"
  | "actions/workflows"
  | "actions/runs";
export class GatewayError extends Error {
  constructor(
    public readonly status: 404 | 503 | 502 | 429,
    message: string,
  ) {
    super(message);
  }
}
export async function repositoryRead(
  env: Environment,
  owner: string,
  repo: string,
  resource: Resource,
  page: number,
  limit: number,
  options?: { path?: string; ref?: string },
) {
  const allowed = (env.ORB_CI_REPOSITORIES ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase());
  if (!allowed.includes((owner + "/" + repo).toLowerCase()))
    throw new GatewayError(404, "Repository unavailable");
  const token = await githubToken(env).catch(() => null);
  if (!token) throw new GatewayError(503, "GitHub credentials unavailable");
  const url = new URL(
    "https://api.github.com/repos/" +
      encodeURIComponent(owner) +
      "/" +
      encodeURIComponent(repo) +
      "/" +
      resource,
  );
  if (resource === "contents") {
    const path = options?.path ?? "";
    if (
      path.length > 1024 ||
      path
        .split("/")
        .some(
          (s) =>
            s === "." || s === ".." || s.includes("\\") || s.includes("\u0000"),
        )
    )
      throw new GatewayError(404, "Invalid path");
    if (path)
      url.pathname += "/" + path.split("/").map(encodeURIComponent).join("/");
    if (options?.ref) url.searchParams.set("ref", options.ref);
  }
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(limit));
  if (resource === "pulls") url.searchParams.set("state", "all");
  const response = await fetch(url, {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "User-Agent": "orb-api",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (
    response.status === 429 ||
    (response.headers.get("x-ratelimit-remaining") === "0" && !response.ok)
  )
    throw new GatewayError(429, "GitHub rate limit exceeded");
  if (response.status === 404)
    throw new GatewayError(404, "Repository resource unavailable");
  if (!response.ok) throw new GatewayError(502, "GitHub request failed");
  const data: unknown = await response.json();
  return {
    data,
    page,
    limit,
    hasNext: (response.headers.get("link") ?? "").includes('rel="next"'),
  };
}
