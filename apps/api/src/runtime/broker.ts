import { unzipSync } from "fflate";
import {
  buildRequestSchema,
  buildResultSchema,
  brokerPolicySchema,
  type BuildTarget,
  type BuildRequest,
  type BuildResult,
  type PublicBuild,
} from "@rodverse/runtime-contracts";
import type { BuildStore, BuildRecord } from "./store.ts";
export class RuntimeError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export type GitHubRequest = (
  path: string,
  init?: RequestInit,
) => Promise<Response>;
function api(target: BuildTarget) {
  return "/repos/" + target.repository;
}
function file(target: BuildTarget) {
  return target.workflowFile.split("/").at(-1)!;
}
export function publicBuild(record: BuildRecord): PublicBuild {
  return {
    schemaVersion: 1,
    id: record.id,
    workspaceId: record.workspaceId,
    targetId: record.targetId,
    sourceSha: record.sourceSha,
    status: record.status,
    runId: record.runId,
    runUrl: record.runId
      ? "https://github.com/" +
        record.target.repository +
        "/actions/runs/" +
        record.runId
      : null,
    runsUrl:
      "https://github.com/" +
      record.target.repository +
      "/actions/workflows/" +
      file(record.target),
    error: record.error,
    result: record.result,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
export function runtimePolicy(raw: string | undefined) {
  if (!raw)
    throw new RuntimeError(503, "Runtime build policy is not configured");
  try {
    return brokerPolicySchema.parse(JSON.parse(raw));
  } catch {
    throw new RuntimeError(503, "Runtime build policy is invalid");
  }
}
export function targetFor(
  targets: BuildTarget[],
  actor: string,
  workspace: string,
  id: string,
) {
  const target = targets.find(
    (t) =>
      t.workspaceId === workspace && t.id === id && t.subjects.includes(actor),
  );
  if (!target) throw new RuntimeError(404, "Runtime target unavailable");
  return target;
}
async function json<T>(
  request: GitHubRequest,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await request(path, init);
  if (!response.ok)
    throw new RuntimeError(
      response.status === 429 ? 429 : 502,
      "GitHub runtime request failed",
    );
  return response.json() as Promise<T>;
}
export class BuildBroker {
  private store: BuildStore;
  private github: GitHubRequest;
  private download: typeof fetch;
  constructor(
    store: BuildStore,
    github: GitHubRequest,
    download: typeof fetch = fetch,
  ) {
    this.store = store;
    this.github = github;
    this.download = download;
  }
  async create(input: unknown, actor: string, targets: BuildTarget[]) {
    const request = buildRequestSchema.parse(input),
      target = targetFor(targets, actor, request.workspaceId, request.targetId);
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify(request)),
        ),
      ),
    )
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    const reservation = await this.store.reserve(request, actor, target, hash),
      record = reservation.record;
    if (record.requestHash !== hash)
      throw new RuntimeError(
        409,
        "Idempotency key already used for another build",
      );
    if (!reservation.created) return publicBuild(record);
    try {
      const definition = await json<{ sha: string }>(
        this.github,
        api(target) +
          "/contents/" +
          target.workflowFile +
          "?ref=" +
          encodeURIComponent(target.workflowRef),
      );
      if (definition.sha !== target.workflowBlobSha)
        throw new RuntimeError(409, "Approved build workflow changed");
      const comparison = await json<{ status: string }>(
        this.github,
        api(target) +
          "/compare/" +
          encodeURIComponent(target.workflowRef) +
          "..." +
          request.sourceSha,
      );
      if (!["identical", "behind"].includes(comparison.status))
        throw new RuntimeError(
          422,
          "Source must be committed in the approved branch",
        );
    } catch (error) {
      await this.store.update(record.id, {
        status: "failed",
        error:
          error instanceof RuntimeError
            ? error.message
            : "Build preflight failed",
      });
      throw error;
    }
    // Reserve before dispatch; an ambiguous response never automatically retries a costly build.
    try {
      const response = await this.github(
        api(target) + "/actions/workflows/" + file(target) + "/dispatches",
        {
          method: "POST",
          body: JSON.stringify({
            ref: target.workflowRef,
            inputs: {
              request_id: record.id,
              workspace_id: request.workspaceId,
              target_id: request.targetId,
              source_sha: request.sourceSha,
            },
          }),
        },
      );
      if (!response.ok) {
        const definite = [400, 401, 403, 404, 422, 429].includes(
          response.status,
        );
        return publicBuild(
          await this.store.update(record.id, {
            status: definite ? "failed" : "dispatch_unknown",
            error: definite
              ? "GitHub rejected build dispatch"
              : "Dispatch outcome unknown; inspect the linked workflow before retrying",
          }),
        );
      }
      const details = await response
          .json<{ workflow_run_id?: number }>()
          .catch(() => null),
        runId = details?.workflow_run_id;
      return publicBuild(
        await this.store.update(record.id, {
          status:
            Number.isSafeInteger(runId) && runId! > 0
              ? "accepted"
              : "dispatch_unknown",
          runId: Number.isSafeInteger(runId) && runId! > 0 ? runId! : null,
          error: null,
        }),
      );
    } catch {
      return publicBuild(
        await this.store.update(record.id, {
          status: "dispatch_unknown",
          error:
            "Dispatch outcome unknown; inspect the linked workflow before retrying",
        }),
      );
    }
  }
  async get(id: string, actor: string, targets: BuildTarget[]) {
    let record = await this.store.get(id);
    if (!record) throw new RuntimeError(404, "Build unavailable");
    const currentTarget = targetFor(
      targets,
      actor,
      record.workspaceId,
      record.targetId,
    );
    if (
      currentTarget.repository !== record.target.repository ||
      currentTarget.imageRepository !== record.target.imageRepository
    )
      throw new RuntimeError(404, "Build unavailable");
    if (record.status === "succeeded" || record.status === "failed")
      return publicBuild(record);
    if (!record.runId) {
      const runs = await json<{
        workflow_runs: Array<{
          id: number;
          display_title: string;
          event: string;
        }>;
      }>(
        this.github,
        api(record.target) +
          "/actions/workflows/" +
          file(record.target) +
          "/runs?event=workflow_dispatch&per_page=100",
      );
      const matches = runs.workflow_runs.filter(
        (run) =>
          run.event === "workflow_dispatch" &&
          run.display_title === "RodSandbox build " + record!.id,
      );
      if (matches.length !== 1) return publicBuild(record);
      record = await this.store.update(record.id, {
        runId: matches[0]!.id,
        status: "accepted",
        error: null,
      });
    }
    const target = record.target;
    const run = await json<{
      id: number;
      event: string;
      path: string;
      head_sha: string;
      status: string;
      conclusion: string | null;
      run_attempt: number;
      repository: { full_name: string };
    }>(this.github, api(target) + "/actions/runs/" + record.runId);
    if (
      run.id !== record.runId ||
      run.event !== "workflow_dispatch" ||
      run.path.split("@")[0] !== target.workflowFile ||
      run.repository.full_name.toLowerCase() !== target.repository
    )
      throw new RuntimeError(502, "Build run provenance mismatch");
    if (run.status !== "completed")
      return publicBuild(
        await this.store.update(record.id, { status: "running" }),
      );
    if (run.conclusion !== "success")
      return publicBuild(
        await this.store.update(record.id, {
          status: "failed",
          error: "GitHub build " + run.conclusion,
        }),
      );
    const definition = await json<{ sha: string }>(
      this.github,
      api(target) + "/contents/" + target.workflowFile + "?ref=" + run.head_sha,
    );
    if (definition.sha !== target.workflowBlobSha)
      throw new RuntimeError(502, "Build workflow provenance mismatch");
    const artifacts = await json<{
      artifacts: Array<{
        id: number;
        name: string;
        size_in_bytes: number;
        expired: boolean;
      }>;
    }>(
      this.github,
      api(target) + "/actions/runs/" + record.runId + "/artifacts?per_page=100",
    );
    const candidates = artifacts.artifacts.filter(
      (a) =>
        a.name === "rod-build-" + record!.id + "-attempt-" + run.run_attempt &&
        !a.expired &&
        a.size_in_bytes < 1048576,
    );
    if (candidates.length !== 1)
      throw new RuntimeError(502, "Build result artifact unavailable");
    const artifact = await this.github(
      api(target) + "/actions/artifacts/" + candidates[0]!.id + "/zip",
      { redirect: "manual" },
    );
    const location = artifact.headers.get("location");
    await artifact.body?.cancel();
    if (artifact.status !== 302 || !location)
      throw new RuntimeError(502, "Build artifact redirect unavailable");
    const url = new URL(location);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !/\.(?:blob\.core\.windows\.net|actions\.githubusercontent\.com)$/.test(
        url.hostname,
      )
    )
      throw new RuntimeError(502, "Untrusted artifact download origin");
    const response = await this.download(url, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok || !response.body)
      throw new RuntimeError(502, "Build artifact download failed");
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 1048576) {
          await reader.cancel();
          throw new RuntimeError(502, "Build artifact too large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let result: BuildResult;
    try {
      const archive = unzipSync(bytes, {
        filter: (entry) =>
          entry.name === "runtime-build-result.json" &&
          entry.originalSize <= 65536,
      });
      if (
        Object.keys(archive).length !== 1 ||
        !archive["runtime-build-result.json"]
      )
        throw Error();
      result = buildResultSchema.parse(
        JSON.parse(
          new TextDecoder().decode(archive["runtime-build-result.json"]),
        ),
      );
    } catch {
      throw new RuntimeError(502, "Invalid build result artifact");
    }
    if (
      result.requestId !== record.id ||
      result.workspaceId !== record.workspaceId ||
      result.targetId !== record.targetId ||
      result.sourceSha !== record.sourceSha ||
      result.repository !== target.repository ||
      result.workflowFile !== target.workflowFile ||
      result.workflowSha !== run.head_sha ||
      result.runId !== run.id ||
      result.runAttempt !== run.run_attempt ||
      result.imageRepository !== target.imageRepository ||
      result.platforms.join(",") !== target.platforms.join(",")
    )
      throw new RuntimeError(502, "Build result provenance mismatch");
    return publicBuild(
      await this.store.update(record.id, {
        status: "succeeded",
        result,
        error: null,
      }),
    );
  }
}
