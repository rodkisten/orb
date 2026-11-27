import { mutateResource } from "./mutations";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { githubAuthMode, githubToken } from "../github-auth";
import { githubHeaders, githubRepositoryUrl, githubTimeout } from "./github-client";
import { repository, annotations, writeAnnotations, environmentName, variableName, repositoryAllowed, reply, type McpEnv } from "./shared";
export function registerConfiguration(server: McpServer, env: McpEnv) {
  async function configuration(
    repo: string,
    environment: string | undefined,
    kind: "variables" | "secrets" | "environments",
    name?: string,
    value?: string,
  ) {
    if (!repositoryAllowed(env, repo))
      return reply({ error: "Repository unavailable" }, true);
    const write = value !== undefined;
    if (write && githubAuthMode(env) !== "app")
      return reply({ error: "GitHub App required" }, true);
    try {
      const token = await githubToken(env);
      const root = githubRepositoryUrl(repo);
      const headers = githubHeaders(token, "2022-11-28", true);
      const signal = githubTimeout(15000);
      const endpoint =
        kind === "environments"
          ? root + "/environments"
          : root +
            (environment
              ? "/environments/" + encodeURIComponent(environment)
              : "/actions") +
            "/" +
            kind;
      if (write && kind === "variables" && name) {
        const target = endpoint + "/" + encodeURIComponent(name);
        const current = await fetch(target, {
          headers,
          redirect: "error",
          signal,
        });
        if (!current.ok && current.status !== 404)
          return reply(
            { error: "Variable lookup failed", status: current.status },
            true,
          );
        await current.body?.cancel();
        const response = await fetch(current.ok ? target : endpoint, {
          method: current.ok ? "PATCH" : "POST",
          headers,
          redirect: "error",
          signal,
          body: JSON.stringify({ name, value }),
        });
        return reply(
          { accepted: response.ok, status: response.status, name, environment },
          !response.ok,
        );
      }
      const response = await fetch(endpoint + "?per_page=30", {
        headers,
        redirect: "error",
        signal,
      });
      if (!response.ok)
        return reply(
          { error: "Configuration lookup failed", status: response.status },
          true,
        );
      const data = await response.json<{
        total_count?: number;
        variables?: Array<{ name: string; updated_at: string }>;
        secrets?: Array<{ name: string; updated_at: string }>;
        environments?: Array<{ name: string; html_url: string }>;
      }>();
      const entries = (data[kind] ?? []).map((item) => ({ name: item.name }));
      return reply({
        entries,
        total: data.total_count,
        hasNext: (response.headers.get("link") ?? "").includes('rel="next"'),
      });
    } catch {
      return reply(
        {
          error: write
            ? "Write not confirmed; inspect before retrying"
            : "Configuration lookup failed",
        },
        true,
      );
    }
  }
  server.registerTool(
    "github_environment_list",
    {
      description: "List repository environments.",
      inputSchema: { repository },
      annotations,
    },
    async (args) => configuration(args.repository, undefined, "environments"),
  );
  server.registerTool(
    "github_environment_upsert",
    {
      description:
        "Create an environment or update its wait timer. Does not accept protection bypass settings.",
      inputSchema: {
        repository,
        environment: environmentName,
        waitTimer: z.number().int().min(0).max(43200).optional(),
      },
      annotations: writeAnnotations,
    },
    async (args) =>
      mutateResource(
        args.repository,
        "/environments/" + encodeURIComponent(args.environment),
        "PUT",
        args.waitTimer === undefined ? {} : { wait_timer: args.waitTimer },
      ),
  );
  server.registerTool(
    "github_variable_list",
    {
      description:
        "List Actions variable names, not values, at repository or environment scope.",
      inputSchema: { repository, environment: environmentName.optional() },
      annotations,
    },
    async (args) =>
      configuration(args.repository, args.environment, "variables"),
  );
  server.registerTool(
    "github_variable_upsert",
    {
      description:
        "Create or update a non-secret Actions variable. Never pass credentials or secret values.",
      inputSchema: {
        repository,
        environment: environmentName.optional(),
        name: variableName,
        value: z.string().max(48000),
      },
      annotations: writeAnnotations,
    },
    async (args) =>
      configuration(
        args.repository,
        args.environment,
        "variables",
        args.name,
        args.value,
      ),
  );
  server.registerTool(
    "github_secret_list",
    {
      description:
        "List Actions secret names only. Never returns secret values.",
      inputSchema: { repository, environment: environmentName.optional() },
      annotations,
    },
    async (args) => configuration(args.repository, args.environment, "secrets"),
  );
}
