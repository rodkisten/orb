/** Pure message policy shared by Smart Commit clients and providers. */
const directives = /\[(?:skip ci|deploy)\]/gi;

const genericPatterns = [
  /^(?:Update|Create|Delete|Rename) [^\r\n]+$/,
  /^Add files via upload$/,
  /^Changes$/,
];

export function classifyMessage(original: string) {
  const markers = original.match(directives) ?? [];
  const subject = original.replace(directives, "").trim();
  return {
    subject,
    markers,
    eligible: genericPatterns.some((pattern) => pattern.test(subject)),
  };
}

/** Reject generated directives and malformed subjects rather than silently accepting them. */
export function validateSuggestion(
  original: string,
  suggestion: string,
): string | null {
  const policy = classifyMessage(original);
  if (!policy.eligible) return null;
  const subject = suggestion.trim();
  if (subject.length > 100 || /[\x00-\x1f\x7f]/.test(subject)) return null;
  if (/\[(?:skip ci|deploy)\]/i.test(subject)) return null;
  if (
    !/^(?:feat|fix|docs|refactor|perf|test|build|ci|chore|style|revert)(?:\([a-z0-9][a-z0-9./_-]*\))?!?: \S.*$/.test(
      subject,
    )
  )
    return null;
  return [subject, ...policy.markers].join(" ");
}
