import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { McpEnv } from "./shared";
import { registerWorkflows } from "./workflows";
import { registerPullRequests } from "./pull-requests";
import { registerIssues } from "./issues";
import { registerGit } from "./git";
import { registerComments } from "./comments";
import { registerConfiguration } from "./configuration";
import { registerSecretSync } from "./secret-sync";

export async function serveDispatchMcp(
  request: Request,
  dispatch: (request: Request) => Promise<Response>,
  env: McpEnv,
): Promise<Response> {
  const server = new McpServer({ name: "orb", version: "0.1.0" });
  registerWorkflows(server, request, dispatch, env);
  registerPullRequests(server, env);
  registerIssues(server, env);
  registerGit(server, env);
  registerComments(server, env);
  registerConfiguration(server, env);
  registerSecretSync(server, env);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
