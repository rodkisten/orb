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
    try {
      const result = await auth({ type: "installation" });
      return result.token;
    } catch (error) {
      const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : null;
      console.warn(JSON.stringify({
        component: "orb.github.auth",
        reason: "installation_token_failed",
        status,
        errorType: error instanceof TypeError ? "TypeError" : "Error",
        pemFormat: /-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(env.ORB_GITHUB_APP_PRIVATE_KEY!),
      }));
      throw error;
    }
  }
  if (mode === "token") return env.ORB_CI_READ_TOKEN!;
  console.warn(JSON.stringify({
    component: "orb.github.auth",
    reason: "missing_credentials",
    appIdPresent: !!env.ORB_GITHUB_APP_ID,
    installationIdPresent: !!env.ORB_GITHUB_APP_INSTALLATION_ID,
    privateKeyPresent: !!env.ORB_GITHUB_APP_PRIVATE_KEY,
  }));
  throw Error("GitHub credentials unavailable");
}
