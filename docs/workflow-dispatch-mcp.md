# Orb workflow dispatch MCP

The Worker exposes one stateless Streamable HTTP tool, `github_workflow_dispatch`, at `/mcp`. The REST equivalent is `POST /v1/github/workflows/dispatch`.

Both require `Authorization: Bearer <ORB_DISPATCH_TOKEN>`. Store a random secret of at least 32 characters in Wrangler. Never put it in a URL or logs. GitHub App Actions write permission and the existing ORB_CI_REPOSITORIES allowlist are required.

## Deployment gates

- API typecheck and Worker bundle must pass.
- Verify unauthenticated requests receive 401 or are blocked by Access.
- Verify authenticated MCP initialize and tools/list expose exactly one tool.
- Keep existing Access protection on other routes. If a separate policy is needed for /mcp, restrict it to that path and retain Worker authentication.
- Confirm the target MCP client supports the configured authentication. A static bearer token alone is not an OAuth implementation. Do not disable authentication to make a client connect.
- Use an explicitly approved harmless workflow for the first dispatch. Never automatically retry an uncertain result.

The response includes runUrl only when GitHub confirms a run ID; otherwise use runsUrl to inspect the workflow.
