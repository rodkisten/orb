import { githubAuthMode, githubToken } from "../github-auth";
import {
  githubHeaders,
  githubRepositoryUrl,
  githubTimeout,
} from "./github-client";
import { repositoryAllowed, reply, type McpEnv } from "./shared";
export async function mutateResource(
  env: McpEnv,
  repo: string,
  path: string,
  method: "POST" | "PATCH" | "PUT",
  body: unknown,
) {
  if (!repositoryAllowed(env, repo))
    return reply({ error: "Repository unavailable" }, true);
  if (githubAuthMode(env) !== "app")
    return reply({ error: "GitHub App required" }, true);
  try {
    const token = await githubToken(env);
    const response = await fetch(githubRepositoryUrl(repo) + path, {
      method,
      headers: githubHeaders(token, "2022-11-28", true),
      body: JSON.stringify(body),
      redirect: "error",
      signal: githubTimeout(15000),
    });
    if (!response.ok)
      return reply(
        { error: "GitHub rejected operation", status: response.status },
        true,
      );
    const data = await response
      .json<{
        id?: number;
        number?: number;
        html_url?: string;
        name?: string;
      }>()
      .catch(() => null);
    return reply({
      accepted: true,
      id: data?.id,
      number: data?.number,
      url: data?.html_url,
      name: data?.name,
    });
  } catch {
    return reply(
      { error: "Write not confirmed; inspect resource before retrying" },
      true,
    );
  }
}
