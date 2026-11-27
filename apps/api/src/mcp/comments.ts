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
  page,
  annotations,
  writeAnnotations,
  repositoryAllowed,
  reply,
  type McpEnv,
} from "./shared";
import { mutateResource } from "./mutations";
export function registerComments(server: McpServer, env: McpEnv) {
  server.registerTool(
    "github_pr_comment_upsert",
    {
      description:
        "Create or update an Orb-managed PR comment identified by a stable key. Never edit another author's comment. Concurrent creates may require reconciliation.",
      inputSchema: {
        repository,
        prNumber: runId,
        key: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
        body: z.string().min(1).max(60000),
      },
      annotations: writeAnnotations,
    },
    async ({ repository: repo, prNumber, key, body }) => {
      if (!repositoryAllowed(env, repo))
        return reply({ error: "Repository unavailable" }, true);
      if (githubAuthMode(env) !== "app")
        return reply({ error: "GitHub App required" }, true);
      if (body.includes("<!-- orb:"))
        return reply({ error: "Reserved comment marker" }, true);
      try {
        const token = await githubToken(env);
        const base = githubRepositoryUrl(repo);
        const headers = githubHeaders(token, "2022-11-28", true);
        const signal = AbortSignal.timeout(20000);
        const pr = await fetch(base + "/pulls/" + prNumber, {
          headers,
          redirect: "error",
          signal,
        });
        if (!pr.ok)
          return reply({ error: "PR unavailable", status: pr.status }, true);
        const marker = "<!-- orb:" + key + " -->";
        let foreignMarker = false;
        const content = marker + "\n" + body;
        const matches: Array<{ id: number; body: string; html_url: string }> =
          [];
        const appId = Number(env.ORB_GITHUB_APP_ID);
        if (!Number.isSafeInteger(appId) || appId <= 0)
          return reply({ error: "Invalid app identity" }, true);
        let complete = false;
        for (let page = 1; page <= 10; page++) {
          const response = await fetch(
            base +
              "/issues/" +
              prNumber +
              "/comments?per_page=100&page=" +
              page,
            { headers, redirect: "error", signal },
          );
          if (!response.ok)
            return reply(
              { error: "Comment lookup failed", status: response.status },
              true,
            );
          const comments = await response.json<
            Array<{
              id: number;
              body: string;
              html_url: string;
              performed_via_github_app?: { id: number };
            }>
          >();
          foreignMarker ||= comments.some(
            (c) =>
              c.body?.startsWith(marker + "\n") &&
              c.performed_via_github_app?.id !== appId,
          );
          matches.push(
            ...comments.filter(
              (c) =>
                c.performed_via_github_app?.id === appId &&
                c.body?.startsWith(marker + "\n"),
            ),
          );
          if (!(response.headers.get("link") ?? "").includes('rel="next"')) {
            complete = true;
            break;
          }
        }
        if (!complete || foreignMarker || matches.length > 1)
          return reply(
            {
              error:
                "Comment lookup incomplete or duplicate markers; reconcile before writing",
            },
            true,
          );
        const existing = matches[0];
        if (existing?.body === content)
          return reply({
            action: "unchanged",
            id: existing.id,
            url: existing.html_url,
          });
        const response = await fetch(
          base +
            (existing
              ? "/issues/comments/" + existing.id
              : "/issues/" + prNumber + "/comments"),
          {
            method: existing ? "PATCH" : "POST",
            headers,
            redirect: "error",
            signal,
            body: JSON.stringify({ body: content }),
          },
        );
        if (!response.ok)
          return reply(
            { error: "Comment write rejected", status: response.status },
            true,
          );
        const comment = await response.json<{ id: number; html_url: string }>();
        return reply({
          action: existing ? "updated" : "created",
          id: comment.id,
          url: comment.html_url,
        });
      } catch {
        return reply(
          { error: "Comment write not confirmed; inspect before retrying" },
          true,
        );
      }
    },
  );
  const bodyText = z.string().max(60000);
  server.registerTool(
    "github_comment_create",
    {
      description:
        "Create a comment on an issue or PR. Use comment upsert for recurring reports.",
      annotations: writeAnnotations,
      inputSchema: { repository, issueNumber: runId, body: bodyText.min(1) },
    },
    async ({ repository: repo, issueNumber, body }) =>
      body.includes("<!-- orb:")
        ? reply({ error: "Reserved comment marker" }, true)
        : mutateResource(
            env,
            repo,
            "/issues/" + issueNumber + "/comments",
            "POST",
            {
              body,
            },
          ),
  );
  server.registerTool(
    "github_comment_edit",
    {
      description:
        "Edit an existing issue or PR comment authored by the configured GitHub App. Managed report comments must use upsert instead.",
      inputSchema: {
        repository,
        commentId: runId,
        body: z.string().min(1).max(60000),
      },
      annotations: writeAnnotations,
    },
    async ({ repository: repo, commentId, body }) => {
      if (!repositoryAllowed(env, repo))
        return reply({ error: "Repository unavailable" }, true);
      if (githubAuthMode(env) !== "app")
        return reply({ error: "GitHub App required" }, true);
      if (body.includes("<!-- orb:"))
        return reply({ error: "Reserved comment marker" }, true);
      try {
        const token = await githubToken(env);
        const url = githubRepositoryUrl(repo) + "/issues/comments/" + commentId;
        const headers = githubHeaders(token, "2022-11-28", true);
        const signal = githubTimeout(15000);
        const current = await fetch(url, {
          headers,
          redirect: "error",
          signal,
        });
        if (!current.ok)
          return reply(
            { error: "Comment unavailable", status: current.status },
            true,
          );
        const comment = await current.json<{
          body: string;
          html_url: string;
          performed_via_github_app?: { id: number };
        }>();
        const appId = Number(env.ORB_GITHUB_APP_ID);
        if (
          !Number.isSafeInteger(appId) ||
          appId <= 0 ||
          comment.performed_via_github_app?.id !== appId
        )
          return reply(
            { error: "Comment is not owned by the configured App" },
            true,
          );
        if (comment.body.includes("<!-- orb:"))
          return reply(
            { error: "Use comment upsert for managed reports" },
            true,
          );
        if (comment.body === body)
          return reply({
            action: "unchanged",
            id: commentId,
            url: comment.html_url,
          });
        const response = await fetch(url, {
          method: "PATCH",
          headers,
          redirect: "error",
          signal,
          body: JSON.stringify({ body }),
        });
        return reply(
          {
            accepted: response.ok,
            status: response.status,
            id: commentId,
            url: comment.html_url,
          },
          !response.ok,
        );
      } catch {
        return reply(
          { error: "Comment edit not confirmed; inspect before retrying" },
          true,
        );
      }
    },
  );
}
