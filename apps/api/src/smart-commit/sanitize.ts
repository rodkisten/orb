export type DiffFile = { path: string; diff: string };

const sensitivePath = /(?:^|\/)(?:\.env(?:\.[^/]*)?|\.npmrc|\.netrc|\.git-credentials|id_(?:rsa|ed25519|ecdsa)|credentials(?:\.[^/]*)?|secrets?(?:\.[^/]*)?)(?:\/|$)|\.(?:pem|key|p12|pfx)$/i;
const sensitiveContent = /-----BEGIN [^-]*PRIVATE KEY-----|\b(?:gh[pousr]_[a-z0-9]{20,}|github_pat_[a-z0-9_]{20,}|AKIA[A-Z0-9]{16}|sk-[a-z0-9_-]{20,})\b|(?:password|api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["']?[^\s"']{8,}/i;

/** Fail closed on known sensitive patterns; this is not exhaustive secret detection. */
export function screenDiff(files: readonly DiffFile[]): DiffFile[] {
  if (!files.length || files.length > 50) throw new Error("Unsupported diff file count");
  const encoder = new TextEncoder();
  let bytes = 0;
  return files.map(({ path, diff }) => {
    if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").some((part) => part === ".." || part === ".") || /[\x00-\x1f\x7f]/.test(path)) {
      throw new Error("Invalid diff path");
    }
    bytes += encoder.encode(path).length + encoder.encode(diff).length;
    if (bytes > 128 * 1024) throw new Error("Diff exceeds size limit");
    if (sensitivePath.test(path) || sensitiveContent.test(diff) || /(?:^|\n)(?:GIT binary patch|Binary files )/.test(diff) || diff.includes("\0")) {
      throw new Error("Potentially sensitive or unsupported diff");
    }
    return { path, diff };
  });
}
