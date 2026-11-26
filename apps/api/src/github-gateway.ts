import { githubToken, type GitHubCredentials } from "./github-auth";
import { Octokit } from "@octokit/core";
import { parseDocument } from "yaml";
const metrics = {
  memoryHits: 0,
  d1Hits: 0,
  coalesced: 0,
  upstream: 0,
  errors: 0,
};
export function gatewayMetrics() {
  return { ...metrics, memoryEntries: memory.size, inFlight: pending.size };
}
const pending = new Map<string, Promise<unknown>>();
const memory = new Map<string, { value: unknown; expires: number }>();
async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export class GitHubGateway {
  static async create(db: D1Database, env: GitHubCredentials) {
    return new GitHubGateway(db, await githubToken(env));
  }
  private client: Octokit;
  constructor(
    private db: D1Database,
    private token: string,
  ) {
    this.client = new Octokit({ auth: token });
  }
  async rest<T>(
    path: string,
    parameters: Record<string, unknown> = {},
  ): Promise<T> {
    if (!/^GET \/[a-zA-Z0-9_/{}/.-]+$/.test(path))
      throw Error("Only internal GET routes supported");
    const result = await this.client.request(path, parameters);
    return result.data as T;
  }
  async query<T>(
    document: string,
    variables: Record<string, unknown>,
    ttl = 60,
  ): Promise<T> {
    const key = await hash(
      JSON.stringify([
        this.token,
        document,
        Object.entries(variables).sort(([a], [b]) => a.localeCompare(b)),
      ]),
    );
    const now = Date.now();
    const hit = memory.get(key);
    if (hit && hit.expires > now) {
      metrics.memoryHits++;
      return hit.value as T;
    }
    const active = pending.get(key);
    if (active) {
      metrics.coalesced++;
      return active as Promise<T>;
    }
    const task = (async () => {
      const cached = await this.db
        .prepare(
          "SELECT payload,expires_at FROM github_cache WHERE key=? AND expires_at>?",
        )
        .bind(key, now)
        .first<{ payload: string; expires_at: number }>()
        .catch(() => null);
      if (cached) {
        metrics.d1Hits++;
        const value = JSON.parse(cached.payload);
        memory.set(key, { value, expires: cached.expires_at });
        return value as T;
      }
      metrics.upstream++;
      const value = await this.client
        .graphql<T>(document, variables)
        .catch((error) => {
          metrics.errors++;
          throw error;
        });
      const expires = Date.now() + ttl * 1000;
      memory.set(key, { value, expires });
      while (memory.size > 128) {
        const first = memory.keys().next().value;
        if (first === undefined) break;
        memory.delete(first);
      }
      const payload = JSON.stringify(value);
      if (payload.length < 500000)
        await this.db
          .prepare(
            "INSERT OR REPLACE INTO github_cache(key,payload,expires_at) VALUES(?,?,?)",
          )
          .bind(key, payload, expires)
          .run()
          .catch(() => null);
      return value;
    })();
    pending.set(key, task);
    try {
      return await task;
    } finally {
      pending.delete(key);
    }
  }
  async repositories(allowlist: string[]) {
    const names = [
      ...new Set(
        allowlist
          .map((name) => name.trim().toLowerCase())
          .filter((name) => /^[\w.-]+\/[\w.-]+$/.test(name)),
      ),
    ].slice(0, 100);
    const results = await Promise.allSettled(
      names.map(async (fullName) => {
        const [owner, name] = fullName.split("/");
        const result = await this.query<{
          repository: {
            nameWithOwner: string;
            description: string | null;
            url: string;
            isPrivate: boolean;
            defaultBranchRef: { name: string } | null;
          } | null;
        }>(
          "query($owner:String!,$name:String!){repository(owner:$owner,name:$name){nameWithOwner description url isPrivate defaultBranchRef{name}}}",
          { owner, name },
          120,
        );
        return result.repository;
      }),
    );
    return {
      repositories: results.flatMap((result) =>
        result.status === "fulfilled" && result.value ? [result.value] : [],
      ),
      unavailable: results.flatMap((result, i) =>
        result.status === "rejected" || !result.value ? [names[i]] : [],
      ),
    };
  }
  async versions(owner: string, name: string) {
    return this.query<{
      repository: {
        isPrivate: boolean;
        refs: { nodes: { name: string; target: { oid: string } }[] };
      } | null;
    }>(
      'query($owner:String!,$name:String!){repository(owner:$owner,name:$name){isPrivate refs(refPrefix:"refs/tags/",first:50,orderBy:{field:TAG_COMMIT_DATE,direction:DESC}){nodes{name target{oid}}}}}',
      { owner, name },
      900,
    ).then((result) => {
      if (!result.repository || result.repository.isPrivate)
        throw Error("Public repository not found");
      return result.repository.refs.nodes;
    });
  }
  async search(q: string) {
    return this.query<{ search: { nodes: unknown[] } }>(
      "query($q:String!){search(query:$q,type:REPOSITORY,first:20){nodes{... on Repository{nameWithOwner description stargazerCount defaultBranchRef{name}}}}}",
      { q: q + " topic:github-actions is:public" },
      300,
    );
  }
  async resolve(uses: string) {
    const match = /^([\w.-]+)\/([\w.-]+)((?:\/[\w.-]+)*)@([\w./-]+)$/.exec(
      uses,
    );
    if (!match || match.slice(1).some((x) => x.split("/").includes("..")))
      throw Error("Invalid action reference");
    const [, owner, name, path, ref] = match;
    const revision = await this.query<{
      repository: { isPrivate: boolean; object: { oid: string } | null } | null;
    }>(
      "query($owner:String!,$name:String!,$ref:String!){repository(owner:$owner,name:$name){isPrivate object(expression:$ref){... on Commit{oid}}}}",
      { owner, name, ref: ref + "^{commit}" },
      60,
    );
    if (
      !revision.repository ||
      revision.repository.isPrivate ||
      !revision.repository.object?.oid
    )
      throw Error("Public revision not found");
    const sha = revision.repository.object.oid;
    const doc =
      "query($owner:String!,$name:String!,$a:String!,$b:String!){repository(owner:$owner,name:$name){isPrivate a:object(expression:$a){... on Blob{oid text}} b:object(expression:$b){... on Blob{oid text}}}}";
    type Blob = { oid: string; text: string | null };
    const result = await this.query<{
      repository: { isPrivate: boolean; a: Blob | null; b: Blob | null } | null;
    }>(
      doc,
      {
        owner,
        name,
        a: sha + ":" + path.slice(1) + (path ? "/" : "") + "action.yml",
        b: sha + ":" + path.slice(1) + (path ? "/" : "") + "action.yaml",
      },
      86400,
    );
    const repo = result.repository;
    if (!repo || repo.isPrivate) throw Error("Public action not found");
    const blob = repo.a ?? repo.b;
    if (!blob?.text) throw Error("Manifest not found");
    const parsed = parseDocument(blob.text);
    if (parsed.errors.length) throw Error("Invalid manifest");
    const data = parsed.toJS() as {
      name?: string;
      description?: string;
      inputs?: Record<
        string,
        { description?: string; required?: boolean; default?: unknown }
      >;
      outputs?: Record<string, { description?: string }>;
      runs?: unknown;
    };
    if (!data?.name || !data.runs) throw Error("Invalid action");
    const ports = (
      v: Record<
        string,
        { description?: string; required?: boolean; default?: unknown }
      > = {},
    ) =>
      Object.entries(v).map(([id, p]) => ({
        id,
        description: p.description ?? "",
        required: p.required === true,
        ...(p.default === undefined ? {} : { default: String(p.default) }),
      }));
    return {
      uses,
      name: data.name,
      description: data.description ?? "",
      commitSha: sha,
      manifestSha: blob.oid,
      inputs: ports(data.inputs),
      outputs: ports(data.outputs),
    };
  }
}
