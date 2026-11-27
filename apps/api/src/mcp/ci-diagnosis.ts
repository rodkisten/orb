import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { githubToken } from "../github-auth";
import { githubHeaders, githubRepositoryUrl } from "./github-client";
import { readJobLogs } from "./job-logs";
import {
  annotations,
  repository,
  repositoryAllowed,
  reply,
  runId,
  type McpEnv,
} from "./shared";

type Run = {
  id: number;
  workflow_id: number;
  name: string;
  status: string;
  conclusion: string | null;
  head_sha: string;
  html_url: string;
};
type Job = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  steps?: Array<{ name: string; number: number; conclusion: string | null }>;
};

async function diagnose(
  env: McpEnv,
  repo: string,
  pr?: number,
  branch?: string,
  specificRun?: number,
  overview = false,
) {
  if (!repositoryAllowed(env, repo))
    return reply({ error: "Repository unavailable" }, true);
  try {
    const signal = AbortSignal.timeout(25000);
    const token = await githubToken(env);
    const base = githubRepositoryUrl(repo);
    const headers = githubHeaders(token);
    async function get<T>(path: string): Promise<T> {
      const response = await fetch(base + path, {
        headers,
        signal,
        redirect: "error",
      });
      if (!response.ok) throw new Error("GitHub status " + response.status);
      return response.json<T>();
    }
    const pull =
      pr === undefined
        ? undefined
        : await get<{
            head: { sha: string };
            base: { ref: string };
            title: string;
            state: string;
            draft: boolean;
            mergeable: boolean | null;
            mergeable_state: string;
            html_url: string;
            changed_files: number;
            additions: number;
            deletions: number;
          }>("/pulls/" + pr);
    const head = pull?.head.sha;
    const context =
      overview && pull
        ? {
            title: pull.title,
            state: pull.state,
            draft: pull.draft,
            mergeable: pull.mergeable,
            mergeableState: pull.mergeable_state,
            base: pull.base.ref,
            url: pull.html_url,
            changedFiles: pull.changed_files,
            additions: pull.additions,
            deletions: pull.deletions,
          }
        : undefined;
    const checksPromise =
      overview && head
        ? get<{
            total_count: number;
            check_runs: Array<{
              id: number;
              name: string;
              status: string;
              conclusion: string | null;
              html_url: string;
            }>;
          }>("/commits/" + head + "/check-runs?per_page=30")
            .then((c) => ({
              total: c.total_count,
              checks: c.check_runs.map((x) => ({
                id: x.id,
                name: x.name,
                status: x.status,
                conclusion: x.conclusion,
                url: x.html_url,
              })),
              truncated: c.total_count > c.check_runs.length,
            }))
            .catch(() => ({ error: "Checks unavailable" }))
        : Promise.resolve(undefined);
    const reviewsPromise =
      overview && pr !== undefined
        ? get<Array<{ id: number; state: string; user?: { login: string } }>>(
            "/pulls/" + pr + "/reviews?per_page=30",
          )
            .then((reviews) => ({
              reviews: reviews.map((x) => ({
                id: x.id,
                state: x.state,
                login: x.user?.login,
              })),
              possiblyTruncated: reviews.length === 30,
            }))
            .catch(() => ({ error: "Reviews unavailable" }))
        : Promise.resolve(undefined);
    const query = new URLSearchParams({ per_page: "30" });
    if (head) query.set("head_sha", head);
    if (branch) query.set("branch", branch);
    const data =
      specificRun === undefined
        ? await get<{ total_count: number; workflow_runs: Run[] }>(
            "/actions/runs?" + query,
          )
        : {
            total_count: 1,
            workflow_runs: [await get<Run>("/actions/runs/" + specificRun)],
          };
    const unique = new Map<number, Run>();
    for (const run of data.workflow_runs) {
      if (head && run.head_sha !== head) continue;
      if (!unique.has(run.workflow_id)) unique.set(run.workflow_id, run);
    }
    const selected = [...unique.values()].slice(0, 4);
    const results = await Promise.all(
      selected.map(async (run) => {
        const summary = {
          id: run.id,
          name: run.name,
          status: run.status,
          conclusion: run.conclusion,
          sha: run.head_sha,
          url: run.html_url,
        };
        try {
          const jobs = await get<{ total_count: number; jobs: Job[] }>(
            "/actions/runs/" + run.id + "/jobs?filter=latest&per_page=30",
          );
          const failed = jobs.jobs.filter(
            (j) => j.conclusion === "failure" || j.conclusion === "timed_out",
          );
          const logs = await Promise.all(
            failed.slice(0, 1).map(async (j) => {
              const result = await readJobLogs(
                env,
                repo,
                j.id,
                8192,
                undefined,
                signal,
              );
              return {
                jobId: j.id,
                result: JSON.parse(result.content[0]!.text),
              };
            }),
          );
          return {
            ...summary,
            jobs: jobs.jobs.map((j) => ({
              id: j.id,
              name: j.name,
              status: j.status,
              conclusion: j.conclusion,
              failedSteps: j.steps
                ?.filter((s) => s.conclusion === "failure")
                .map((s) => ({ name: s.name, number: s.number })),
            })),
            jobsTruncated: jobs.total_count > jobs.jobs.length,
            logs,
            logsOmitted: Math.max(0, failed.length - 1),
          };
        } catch {
          return { ...summary, error: "Job details unavailable" };
        }
      }),
    );
    const [checks, reviews] = await Promise.all([
      checksPromise,
      reviewsPromise,
    ]);
    const headChanged =
      pr === undefined
        ? undefined
        : await get<{ head: { sha: string } }>("/pulls/" + pr)
            .then((p) => p.head.sha !== head)
            .catch(() => null);
    return reply({
      repository: repo,
      pr,
      head,
      branch,
      context,
      checks,
      reviews,
      headChanged,
      runs: results,
      runHistoryTruncated: data.total_count > data.workflow_runs.length,
      workflowsOmitted: Math.max(0, unique.size - selected.length),
      scope: "latest observed run per workflow; PR runs matched by head SHA",
    });
  } catch {
    return reply({ error: "CI diagnosis unavailable" }, true);
  }
}
export function registerCiDiagnosis(server: McpServer, env: McpEnv) {
  server.registerTool(
    "github_pr_logs",
    {
      description:
        "Inspect PR workflow status, jobs, failed steps and bounded failure logs in one call.",
      inputSchema: { repository, prNumber: runId },
      annotations,
    },
    async (args) => diagnose(env, args.repository, args.prNumber),
  );
  server.registerTool(
    "github_workflow_diagnose",
    {
      description:
        "Inspect one workflow run, jobs, failed steps and bounded failure logs.",
      inputSchema: { repository, runId },
      annotations,
    },
    async (args) =>
      diagnose(env, args.repository, undefined, undefined, args.runId),
  );
  server.registerTool(
    "github_pr_overview",
    {
      description:
        "Inspect PR metadata, mergeability, reviews, checks and CI in one call. Required checks and review policy are not verified.",
      inputSchema: { repository, prNumber: runId },
      annotations,
    },
    async (args) =>
      diagnose(env, args.repository, args.prNumber, undefined, undefined, true),
  );
  server.registerTool(
    "github_repository_ci",
    {
      description:
        "Inspect recent repository workflow runs, jobs and bounded failure logs in one call.",
      inputSchema: {
        repository,
        branch: z.string().min(1).max(255).optional(),
      },
      annotations,
    },
    async (args) => diagnose(env, args.repository, undefined, args.branch),
  );
}
