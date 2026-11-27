import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { githubAuthMode, githubToken } from "../github-auth";
import {
  githubHeaders,
  githubRepositoryUrl,
  githubTimeout,
} from "./github-client";
import {
  repository,
  runId,
  annotations,
  writeAnnotations,
  repositoryAllowed,
  reply,
  type McpEnv,
} from "./shared";
import { mutateResource } from "./mutations";
export function registerPullRequests(server: McpServer, env: McpEnv) {
  async function pullOperation(
    repo: string,
    pr: number,
    action: "sync" | "checks",
    expectedHead?: string,
  ) {
    if (!repositoryAllowed(env, repo))
      return reply({ error: "Repository unavailable" }, true);
    if (action === "sync" && githubAuthMode(env) !== "app")
      return reply({ error: "GitHub App required" }, true);
    try {
      const token = await githubToken(env);
      const base = githubRepositoryUrl(repo);
      const headers = githubHeaders(token, "2022-11-28", true);
      const signal = githubTimeout(15000);
      const request = await fetch(base + "/pulls/" + pr, {
        headers,
        redirect: "error",
        signal,
      });
      if (!request.ok)
        return reply(
          { error: "Pull request unavailable", status: request.status },
          true,
        );
      const pull = await request.json<{
        state: string;
        merged: boolean;
        head: { sha: string };
        base: { ref: string };
      }>();
      if (action === "sync") {
        if (
          pull.state !== "open" ||
          pull.merged ||
          pull.head.sha !== expectedHead
        )
          return reply(
            { error: "PR closed or head changed; refresh before syncing" },
            true,
          );
        const response = await fetch(base + "/pulls/" + pr + "/update-branch", {
          method: "PUT",
          headers,
          redirect: "error",
          signal,
          body: JSON.stringify({ expected_head_sha: expectedHead }),
        });
        return reply(
          { accepted: response.ok, status: response.status, pr, expectedHead },
          !response.ok,
        );
      }
      const sha = encodeURIComponent(pull.head.sha);
      const [checks, statuses] = await Promise.all([
        fetch(base + "/commits/" + sha + "/check-runs?per_page=30", {
          headers,
          redirect: "error",
          signal,
        }),
        fetch(base + "/commits/" + sha + "/status?per_page=30", {
          headers,
          redirect: "error",
          signal,
        }),
      ]);
      if (!checks.ok || !statuses.ok)
        return reply(
          {
            error: "Checks unavailable",
            checksStatus: checks.status,
            commitStatus: statuses.status,
          },
          true,
        );
      const checkData = await checks.json<{
        total_count: number;
        check_runs: Array<{
          name: string;
          status: string;
          conclusion: string | null;
          html_url: string;
        }>;
      }>();
      const statusData = await statuses.json<{
        state: string;
        total_count: number;
        statuses: Array<{ context: string; state: string }>;
      }>();
      return reply({
        pr,
        headSha: pull.head.sha,
        base: pull.base.ref,
        checks: checkData.check_runs.map((c) => ({
          name: c.name,
          status: c.status,
          conclusion: c.conclusion,
          url: c.html_url,
        })),
        checkCount: checkData.total_count,
        combinedStatus: statusData.state,
        statuses: statusData.statuses.map((s) => ({
          context: s.context,
          state: s.state,
        })),
        statusCount: statusData.total_count,
        requiredChecksVerified: false,
      });
    } catch {
      return reply(
        {
          error:
            action === "sync"
              ? "Sync not confirmed; inspect PR before retrying"
              : "GitHub request failed",
        },
        true,
      );
    }
  }
  server.registerTool(
    "github_pr_sync",
    {
      description:
        "Request GitHub to update an open PR from its base branch. Requires the current expected head SHA.",
      inputSchema: {
        repository,
        prNumber: runId,
        expectedHeadSha: z.string().regex(/^[a-f0-9]{40}$/i),
      },
      annotations: writeAnnotations,
    },
    async (args) =>
      pullOperation(
        args.repository,
        args.prNumber,
        "sync",
        args.expectedHeadSha,
      ),
  );
  server.registerTool(
    "github_pr_checks",
    {
      description:
        "Inspect current PR head check runs and commit statuses. Does not determine branch protection requirements.",
      inputSchema: { repository, prNumber: runId },
      annotations,
    },
    async (args) => pullOperation(args.repository, args.prNumber, "checks"),
  );
  const title = z.string().min(1).max(256);
  const bodyText = z.string().max(60000);
  const refName = z.string().min(1).max(255);
  server.registerTool(
    "github_pr_create",
    {
      description: "Create a pull request from an existing branch.",
      annotations: writeAnnotations,
      inputSchema: {
        repository,
        title,
        body: bodyText.optional(),
        head: refName,
        base: refName,
        draft: z.boolean().default(true),
      },
    },
    async ({ repository: repo, ...body }) =>
      mutateResource(env, repo, "/pulls", "POST", body),
  );
  server.registerTool(
    "github_pr_edit",
    {
      description:
        "Edit PR title, description or base branch. Does not merge or close the PR.",
      annotations: writeAnnotations,
      inputSchema: {
        repository,
        prNumber: runId,
        title: title.optional(),
        body: bodyText.optional(),
        base: refName.optional(),
      },
    },
    async ({ repository: repo, prNumber, ...body }) =>
      mutateResource(env, repo, "/pulls/" + prNumber, "PATCH", body),
  );
}
