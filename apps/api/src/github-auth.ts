import { createAppAuth } from "@octokit/auth-app";

export type GitHubCredentials = {
  ORB_GITHUB_APP_ID?: string;
  ORB_GITHUB_APP_PRIVATE_KEY?: string;
  ORB_GITHUB_APP_INSTALLATION_ID?: string;
  ORB_CI_READ_TOKEN?: string;
};

export function githubAuthMode(
  env: GitHubCredentials,
): "app" | "token" | "unconfigured" {
  if (
    env.ORB_GITHUB_APP_ID &&
    env.ORB_GITHUB_APP_PRIVATE_KEY &&
    env.ORB_GITHUB_APP_INSTALLATION_ID
  )
    return "app";
  return env.ORB_CI_READ_TOKEN ? "token" : "unconfigured";
}

export async function githubToken(env: GitHubCredentials): Promise<string> {
  const mode = githubAuthMode(env);
  if (mode === "app") {
    const installationId = Number(env.ORB_GITHUB_APP_INSTALLATION_ID);
    if (!Number.isSafeInteger(installationId) || installationId <= 0)
      throw Error("Invalid GitHub installation ID");
    const auth = createAppAuth({
      appId: env.ORB_GITHUB_APP_ID!,
      privateKey: env.ORB_GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      installationId,
    });
    const result = await auth({ type: "installation" });
    return result.token;
  }
  if (mode === "token") return env.ORB_CI_READ_TOKEN!;
  throw Error("GitHub credentials unavailable");
}
