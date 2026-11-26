import type { PrFailure } from "./github-pr-ci";

const maxBytes = 256 * 1024;
export type LogExcerpt = { text: string; truncated: boolean };

export async function readStepLog(
  owner: string,
  repo: string,
  failure: PrFailure,
  token: string,
): Promise<LogExcerpt | null> {
  const log = new URL(failure.logUrl);
  const job = /\/job\/(\d+)$/.exec(log.pathname)?.[1];
  const step = /^#step:(\d+):1$/.exec(log.hash)?.[1];
  if (!job || !step) return null;

  const signal = AbortSignal.timeout(8000);
  const api =
    "https://api.github.com/repos/" +
    encodeURIComponent(owner) +
    "/" +
    encodeURIComponent(repo);
  const redirect = await fetch(
    api + "/actions/jobs/" + job + "/steps/" + step + "/logs",
    {
      redirect: "manual",
      signal,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "User-Agent": "orb-api",
      },
    },
  );
  await redirect.body?.cancel();
  const location = redirect.headers.get("location");
  if (redirect.status !== 302 || !location) return null;
  const download = new URL(location);
  if (
    download.protocol !== "https:" ||
    download.username ||
    download.password ||
    download.port ||
    !/\.(?:blob\.core\.windows\.net|actions\.githubusercontent\.com)$/.test(
      download.hostname,
    )
  )
    return null;

  // The signed URL is sufficient. Never forward the GitHub credential.
  const response = await fetch(download, { redirect: "error", signal });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    return null;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let bytes = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value.subarray(0, maxBytes - bytes), {
        stream: true,
      });
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        truncated = true;
        await reader.cancel();
        break;
      }
    }
    raw += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  const lines = raw.trimEnd().split("\n");
  let error = -1;
  for (let index = lines.length - 1; index >= 0; index--) {
    if (lines[index].includes("##[error]")) {
      error = index;
      break;
    }
  }
  const end = error < 0 ? lines.length : Math.min(lines.length, error + 6);
  const text = lines
    .slice(Math.max(0, end - 30), end)
    .join("\n")
    .slice(-6000);
  return text
    ? {
        text,
        truncated: truncated || lines.length > 30 || text.length === 6000,
      }
    : null;
}
