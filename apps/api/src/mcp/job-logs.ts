import { redactDiagnostic } from "./redaction";
import { githubToken } from "../github-auth";
import { githubHeaders, githubRepositoryUrl } from "./github-client";
import { reply, type McpEnv } from "./shared";

export async function readJobLogs(
  env: McpEnv,
  repo: string,
  jobId: number,
  maxBytes: number,
  stepNumber?: number,
  deadline?: AbortSignal,
) {
  const allowed = (env.ORB_CI_REPOSITORIES ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase());
  if (!allowed.includes(repo.toLowerCase()))
    return reply({ error: "Repository unavailable" }, true);
  try {
    const token = await githubToken(env);
    const signal = deadline ?? AbortSignal.timeout(20000);
    const endpoint =
      githubRepositoryUrl(repo) +
      "/actions/jobs/" +
      jobId +
      (stepNumber ? "/steps/" + stepNumber : "") +
      "/logs";
    const response = await fetch(endpoint, {
      headers: githubHeaders(token, "2026-03-10", false),
      redirect: "manual",
      signal,
    });
    if (response.status !== 302)
      return reply(
        { error: "Job logs unavailable", status: response.status },
        true,
      );
    const location = response.headers.get("location");
    if (!location)
      return reply({ error: "Missing log download location" }, true);
    const url = new URL(location);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !/^(?:[a-z0-9-]+\.)*(?:blob\.core\.windows\.net|actions\.githubusercontent\.com)$/i.test(
        url.hostname,
      )
    )
      return reply({ error: "Unrecognized log storage host" }, true);
    // The signed URL is used once, without GitHub credentials, and is never returned.
    const download = await fetch(url, { redirect: "error", signal });
    if (!download.ok || !download.body)
      return reply(
        { error: "Log download failed", status: download.status },
        true,
      );
    const reader = download.body.getReader();
    const decoder = new TextDecoder();
    let logs = "",
      bytes = 0,
      truncated = false;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        const take = Math.min(chunk.value.byteLength, maxBytes - bytes);
        logs += decoder.decode(chunk.value.subarray(0, take), {
          stream: true,
        });
        bytes += take;
        if (take < chunk.value.byteLength || bytes === maxBytes) {
          truncated = true;
          break;
        }
      }
      logs += decoder.decode();
    } finally {
      await reader.cancel().catch(() => {});
    }
    logs = redactDiagnostic(logs, [token]);
    return reply({ jobId, stepNumber, bytes, truncated, logs });
  } catch {
    return reply({ error: "Unable to retrieve job logs" }, true);
  }
}
