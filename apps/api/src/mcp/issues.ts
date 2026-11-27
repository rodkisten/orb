import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { repository, runId, writeAnnotations, type McpEnv } from "./shared";
import { mutateResource } from "./mutations";
export function registerIssues(server: McpServer, env: McpEnv) {
  const title = z.string().min(1).max(256);
  const bodyText = z.string().max(60000);
  const labelName = z.string().min(1).max(50);

  server.registerTool(
    "github_issue_create",
    {
      description: "Create an issue in an allowed repository.",
      annotations: writeAnnotations,
      inputSchema: {
        repository,
        title,
        body: bodyText.optional(),
        labels: z.array(labelName).max(30).optional(),
      },
    },
    async ({ repository: repo, ...body }) =>
      mutateResource(env, repo, "/issues", "POST", body),
  );
  server.registerTool(
    "github_issue_edit",
    {
      description: "Edit issue title, description or labels.",
      annotations: writeAnnotations,
      inputSchema: {
        repository,
        issueNumber: runId,
        title: title.optional(),
        body: bodyText.optional(),
        labels: z.array(labelName).max(30).optional(),
      },
    },
    async ({ repository: repo, issueNumber, ...body }) =>
      mutateResource(env, repo, "/issues/" + issueNumber, "PATCH", body),
  );
  const color = z.string().regex(/^[a-fA-F0-9]{6}$/);
  server.registerTool(
    "github_label_create",
    {
      description: "Create a repository label.",
      annotations: writeAnnotations,
      inputSchema: {
        repository,
        name: labelName,
        color,
        description: z.string().max(100).optional(),
      },
    },
    async ({ repository: repo, ...body }) =>
      mutateResource(env, repo, "/labels", "POST", body),
  );
  server.registerTool(
    "github_label_edit",
    {
      description: "Edit a repository label by its existing name.",
      annotations: writeAnnotations,
      inputSchema: {
        repository,
        name: labelName,
        newName: labelName.optional(),
        color: color.optional(),
        description: z.string().max(100).optional(),
      },
    },
    async ({ repository: repo, name, newName, ...body }) =>
      mutateResource(
        env,
        repo,
        "/labels/" + encodeURIComponent(name),
        "PATCH",
        {
          ...body,
          new_name: newName,
        },
      ),
  );
}
