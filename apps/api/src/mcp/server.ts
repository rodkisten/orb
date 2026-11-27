import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

// Stateless MCP transport; the existing REST route enforces machine authorization.
export async function serveDispatchMcp(
  request: Request,
  dispatch: (request: Request) => Promise<Response>,
): Promise<Response> {
  const server = new McpServer({ name: "orb", version: "0.1.0" });
  server.registerTool(
    "github_workflow_dispatch",
    {
      description:
        "Dispatch an allowed GitHub Actions workflow. Do not retry an unconfirmed dispatch automatically.",
      inputSchema: {
        repository: z
          .string()
          .regex(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/),
        workflow: z
          .string()
          .max(230)
          .regex(/^[A-Za-z0-9_.-]+\.ya?ml$/),
        ref: z.string().min(1).max(255),
        inputs: z.record(z.string(), z.string()).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const response = await dispatch(
        new Request(new URL("/v1/github/workflows/dispatch", request.url), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: request.headers.get("authorization") ?? "",
          },
          body: JSON.stringify(args),
        }),
      );
      return {
        isError: !response.ok,
        content: [{ type: "text", text: await response.text() }],
      };
    },
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
