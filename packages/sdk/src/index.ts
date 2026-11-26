// Generated client exports are added after the first OpenAPI generation.
// Keep this public entrypoint stable for consumers.
export const orbSdkPackage = "@orb/sdk" as const;

export function createOrbClient(base: string, transport: typeof fetch = fetch) {
  async function get<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    const url = new URL(path, base);
    url.search = new URLSearchParams(params).toString();
    const response = await transport(url, { credentials: "include" });
    if (!response.ok) throw Error("orb HTTP " + response.status);
    return response.json() as Promise<T>;
  }
  return {
    actions: {
      versions: (owner: string, repo: string) =>
        get<{ name: string; target: { oid: string } }[]>(
          "/v1/actions/versions",
          { owner, repo },
        ),
      search: (q: string) =>
        get<{ search: { nodes: unknown[] } }>("/v1/actions/search", { q }),
      resolve: (uses: string) =>
        get<{
          uses: string;
          name: string;
          commitSha: string;
          manifestSha: string;
          inputs: {
            id: string;
            description: string;
            required: boolean;
            default?: string;
          }[];
          outputs: { id: string; description: string; required: boolean }[];
        }>("/v1/actions/resolve", { uses }),
    },
  };
}
