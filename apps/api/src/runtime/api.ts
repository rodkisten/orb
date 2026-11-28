import { workspaceId, publicTargetSchema } from "@rodverse/runtime-contracts";
import { ZodError } from "zod";
import {
  githubAuthMode,
  githubToken,
  type GitHubCredentials,
} from "../github-auth.ts";
import { githubHeaders } from "../mcp/github-client.ts";
import { BuildBroker, RuntimeError, runtimePolicy } from "./broker.ts";
import { D1BuildStore } from "./store.ts";
export type RuntimeBindings = GitHubCredentials & {
  ORB_RUNTIME_TOKEN?: string;
  ORB_RUNTIME_POLICY?: string;
  ORB_DB: D1Database;
};
async function authorize(request: Request, secret: string | undefined) {
  if (!secret || secret.length < 32)
    throw new RuntimeError(503, "Runtime machine credential is not configured");
  if (request.headers.has("origin"))
    throw new RuntimeError(403, "Runtime API requires a server adapter");
  const supplied = request.headers.get("authorization") ?? "";
  const hashes = await Promise.all(
    ["Bearer " + secret, supplied].map((text) =>
      crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  );
  let diff = 0;
  const left = new Uint8Array(hashes[0]!),
    right = new Uint8Array(hashes[1]!);
  for (let i = 0; i < 32; i++) diff |= left[i]! ^ right[i]!;
  const actor = request.headers.get("x-rod-subject");
  if (diff || !actor || actor.length > 255 || /[\x00-\x1f\x7f]/.test(actor))
    throw new RuntimeError(401, "Unauthorized runtime adapter");
  return actor;
}
export async function handleRuntime(
  request: Request,
  env: RuntimeBindings,
): Promise<Response> {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  };
  try {
    const actor = await authorize(request, env.ORB_RUNTIME_TOKEN),
      targets = runtimePolicy(env.ORB_RUNTIME_POLICY).targets;
    const url = new URL(request.url),
      path = url.pathname.slice("/v1/runtime".length);
    if (request.method === "GET" && path === "/targets") {
      const workspace = workspaceId.parse(url.searchParams.get("workspaceId"));
      return Response.json(
        {
          schemaVersion: 1,
          targets: targets
            .filter(
              (t) => t.workspaceId === workspace && t.subjects.includes(actor),
            )
            .map((t) =>
              publicTargetSchema.parse({
                id: t.id,
                workspaceId: t.workspaceId,
                repository: t.repository,
                imageRepository: t.imageRepository,
                platforms: t.platforms,
              }),
            ),
        },
        { headers },
      );
    }
    if (githubAuthMode(env) !== "app")
      throw new RuntimeError(503, "GitHub App required for runtime builds");
    let token: Promise<string> | undefined;
    const broker = new BuildBroker(
      new D1BuildStore(env.ORB_DB),
      async (path, init = {}) => {
        if (!path.startsWith("/repos/") || path.includes("://"))
          throw new RuntimeError(500, "Invalid GitHub runtime route");
        token ??= githubToken(env);
        return fetch("https://api.github.com" + path, {
          ...init,
          headers: {
            ...githubHeaders(await token, "2026-03-10"),
            ...init.headers,
          },
          redirect: init.redirect ?? "error",
          signal: AbortSignal.timeout(15000),
        });
      },
    );
    if (path === "/builds" && request.method === "POST") {
      if (Number(request.headers.get("content-length") ?? 0) > 4096)
        throw new RuntimeError(413, "Runtime request too large");
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > 4096)
        throw new RuntimeError(413, "Runtime request too large");
      const data = await broker.create(JSON.parse(raw), actor, targets);
      return Response.json(data, { status: 202, headers });
    }
    const match = /^\/builds\/([a-f0-9-]{36})$/.exec(path);
    if (match && request.method === "GET")
      return Response.json(await broker.get(match[1]!, actor, targets), {
        headers,
      });
    return Response.json(
      { error: "Runtime route unavailable" },
      { status: 404, headers },
    );
  } catch (error) {
    const status =
      error instanceof RuntimeError
        ? error.status
        : error instanceof ZodError || error instanceof SyntaxError
          ? 400
          : 502;
    return Response.json(
      {
        error:
          error instanceof RuntimeError
            ? error.message
            : status === 400
              ? "Invalid runtime request"
              : "Runtime request failed",
      },
      { status, headers },
    );
  }
}
