/** Best-effort redaction for diagnostic text, not a guarantee of secret-free output. */
export function redactDiagnostic(
  text: string,
  knownValues: readonly string[] = [],
): string {
  let result = text;
  for (const value of [...new Set(knownValues)]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)) {
    result = result.replaceAll(value, "[REDACTED]");
  }
  return result
    .replace(
      /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g,
      "[REDACTED PRIVATE KEY]",
    )
    .replace(/(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, "[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/=-]+/gi, "Bearer [REDACTED]")
    .replace(
      /(\b(?:password|client_secret|access_token|refresh_token|api_key|authorization|cf-access-client-secret)\b["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)(?=\s|[,;]|$)/gi,
      "$1[REDACTED]",
    );
}
