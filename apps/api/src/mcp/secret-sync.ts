import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { repositoryRead } from "../repository-read";
import { githubAuthMode, githubToken } from "../github-auth";
import { sealGitHubSecret } from "./sealed-secret";

export function registerSecretSync(server: McpServer, env: Parameters<typeof repositoryRead>[0]) {
  const repository = z.string().regex(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/);
  const environmentName = z.string().min(1).max(255).refine(v => v !== "." && v !== ".." && !/[\x00-\x1f]/.test(v));
  const variableName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,254}$/);
  const writeAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };
  server.registerTool(
    "github_secret_upsert",
    {
      description:
        "Synchronize a preconfigured Worker secret to its fixed GitHub Actions destination by alias. Never accepts or returns secret values.",
      inputSchema: { alias: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) },
      annotations: writeAnnotations,
    },
    async ({ alias }) => {
      const reply = (value: unknown, isError = false) => ({
        isError,
        content: [{ type: "text" as const, text: JSON.stringify(value) }],
      });
      try {
        const bindings = env as unknown as Record<string, unknown>;
        const raw = bindings.ORB_SECRET_SYNC_MAP;
        if (
          typeof raw !== "string" ||
          raw.length > 32768 ||
          githubAuthMode(env) !== "app"
        )
          return reply({ error: "Secret synchronization unavailable" }, true);
        const mapping = z
          .record(
            z.object({
              binding: z.string().regex(/^ORB_SYNC_VALUE_[A-Z0-9_]+$/),
              repository,
              environment: environmentName.optional(),
              name: variableName,
            }),
          )
          .parse(JSON.parse(raw));
        if (!Object.prototype.hasOwnProperty.call(mapping, alias))
          return reply({ error: "Unknown secret alias" }, true);
        const target = mapping[alias]!;
        if (
          !(env.ORB_CI_REPOSITORIES ?? "")
            .split(",")
            .map((v) => v.trim().toLowerCase())
            .includes(target.repository.toLowerCase())
        )
          return reply({ error: "Destination unavailable" }, true);
        const value = bindings[target.binding];
        if (
          typeof value !== "string" ||
          !value ||
          new TextEncoder().encode(value).length > 48000
        )
          return reply({ error: "Source unavailable" }, true);
        const token = await githubToken(env);
        const endpoint =
          "https://api.github.com/repos/" +
          target.repository.split("/").map(encodeURIComponent).join("/") +
          (target.environment
            ? "/environments/" + encodeURIComponent(target.environment)
            : "/actions") +
          "/secrets";
        const headers = {
          Authorization: "Bearer " + token,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "orb-api",
          "X-GitHub-Api-Version": "2022-11-28",
        };
        const signal = AbortSignal.timeout(15000);
        const keyResponse = await fetch(endpoint + "/public-key", {
          headers,
          signal,
          redirect: "error",
        });
        if (!keyResponse.ok)
          return reply(
            { error: "Public key unavailable", status: keyResponse.status },
            true,
          );
        const key = z
          .object({ key: z.string(), key_id: z.string() })
          .parse(await keyResponse.json());
        const encrypted_value = await sealGitHubSecret(key.key, value);
        const response = await fetch(
          endpoint + "/" + encodeURIComponent(target.name),
          {
            method: "PUT",
            headers,
            signal,
            redirect: "error",
            body: JSON.stringify({ encrypted_value, key_id: key.key_id }),
          },
        );
        return reply(
          { accepted: response.ok, status: response.status, alias },
          !response.ok,
        );
      } catch {
        return reply({ error: "Secret synchronization not confirmed" }, true);
      }
    },
  );
}
