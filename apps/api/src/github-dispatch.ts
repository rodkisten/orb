import { inspectWorkflow } from "@orb/workflow-core";
import { workflowSource } from "./workflow-builder";
import { githubToken, githubAuthMode } from "./github-auth";
import { GatewayError } from "./repository-read";

export type DispatchEnvironment = Parameters<typeof workflowSource>[0] &
  Parameters<typeof githubToken>[0];
export type DispatchBody = {
  path: string;
  ref: string;
  sha: string;
  inputs: Record<string, string>;
};

export async function dispatchWorkflow(
  env: DispatchEnvironment,
  params: { owner: string; repo: string },
  body: DispatchBody,
) {
  const set = { status: 202 };
  const result = await (async () => {
    if (githubAuthMode(env) !== "app") {
      set.status = 503;
      return { error: "GitHub App required for dispatch" };
    }
    try {
      const source = await workflowSource(
        env,
        params.owner,
        params.repo,
        body.path,
        body.ref,
      );
      if (source.sha !== body.sha) {
        set.status = 409;
        return { error: "Published workflow changed; reload the form" };
      }
      const model = inspectWorkflow(source.yaml);
      if (!model.valid || !model.triggerNames.includes("workflow_dispatch")) {
        set.status = 422;
        return { error: "Workflow has no valid manual trigger" };
      }
      const schema = model.dispatchSchema as Record<
        string,
        {
          type?: string;
          required?: boolean;
          default?: unknown;
          options?: string[];
        }
      >;
      const inputs = body.inputs;
      if (
        Object.keys(inputs).length > 25 ||
        JSON.stringify(inputs).length > 65535 ||
        Object.keys(inputs).some((k) => !Object.hasOwn(schema, k))
      ) {
        set.status = 422;
        return { error: "Invalid input names or payload size" };
      }
      for (const [key, field] of Object.entries(schema)) {
        const v = Object.hasOwn(inputs, key) ? inputs[key] : undefined;
        if (v === undefined) {
          if (field.required && field.default === undefined) {
            set.status = 422;
            return { error: "Missing required input: " + key };
          }
          continue;
        }
        if (
          (field.required && !v.trim()) ||
          (field.type === "boolean" && !["true", "false"].includes(v)) ||
          (field.type === "number" &&
            (!v.trim() || !Number.isFinite(Number(v)))) ||
          (field.type === "choice" && !field.options?.includes(v))
        ) {
          set.status = 422;
          return { error: "Invalid input: " + key };
        }
      }
      const token = await githubToken(env);
      const repoUrl =
        "https://api.github.com/repos/" +
        encodeURIComponent(params.owner) +
        "/" +
        encodeURIComponent(params.repo);
      const response = await fetch(
        repoUrl +
          "/actions/workflows/" +
          encodeURIComponent(body.path.split("/").pop()!) +
          "/dispatches",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "orb-api",
            "X-GitHub-Api-Version": "2026-03-10",
          },
          body: JSON.stringify({ ref: body.ref, inputs }),
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) {
        set.status =
          response.status === 403 ? 403 : response.status === 422 ? 422 : 502;
        return {
          error: "GitHub rejected dispatch (" + response.status + ")",
        };
      }
      const details = await response
        .json<{ workflow_run_id?: number }>()
        .catch(() => null);
      const runId = details?.workflow_run_id;
      set.status = 202;
      return {
        accepted: true,
        runId: Number.isSafeInteger(runId) && runId! > 0 ? runId : undefined,
        runUrl:
          Number.isSafeInteger(runId) && runId! > 0
            ? "https://github.com/" +
              params.owner +
              "/" +
              params.repo +
              "/actions/runs/" +
              runId
            : undefined,
        runsUrl:
          "https://github.com/" +
          params.owner +
          "/" +
          params.repo +
          "/actions/workflows/" +
          encodeURIComponent(body.path.split("/").pop()!),
      };
    } catch (error) {
      set.status = error instanceof GatewayError ? error.status : 502;
      return {
        error: "Dispatch not confirmed; check GitHub before retrying",
      };
    }
  })();
  return { status: set.status, result };
}
