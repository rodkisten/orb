/** Shared GitHub REST request primitives. Never forward these headers to signed download URLs. */
export function githubHeaders(token: string, version = "2022-11-28", json = true): Record<string, string> {
  return {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    "User-Agent": "orb-api",
    "X-GitHub-Api-Version": version,
  };
}

export function githubRepositoryUrl(repository: string): string {
  return "https://api.github.com/repos/" + repository.split("/").map(encodeURIComponent).join("/");
}

export function githubTimeout(milliseconds = 15000): AbortSignal {
  return AbortSignal.timeout(milliseconds);
}
