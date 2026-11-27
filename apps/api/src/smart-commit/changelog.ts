/** Adapter boundary for official changelog parsers. Never execute repository configuration. */
export type ParsedCommit = {
  type: string | null;
  scope: string | null;
  subject: string | null;
  breaking: boolean;
};

export type ChangelogRule = {
  message?: string;
  group?: string;
  skip?: boolean;
};

export type ChangelogAdapter = {
  parse(message: string): Promise<ParsedCommit>;
  /** Must use the target engine's regex semantics, not an assumed JS equivalent. */
  matches(pattern: string, message: string): Promise<boolean>;
};

export async function evaluateChangelog(
  message: string,
  rules: readonly ChangelogRule[],
  adapter: ChangelogAdapter,
  protectBreaking = true,
) {
  const parsed = await adapter.parse(message);
  if (!parsed.type || !parsed.subject) throw new Error("Unrecognized commit format");
  let group: string | null = null;
  let skipped = false;
  for (const rule of rules) {
    if (!rule.message) throw new Error("Unsupported changelog rule selector");
    if (!(await adapter.matches(rule.message, message))) continue;
    group = rule.group ?? null;
    skipped = Boolean(rule.skip) && !(protectBreaking && parsed.breaking);
    break;
  }
  const semverSuggestion = parsed.breaking ? "major" : parsed.type === "feat" ? "minor" : parsed.type === "fix" || parsed.type === "perf" ? "patch" : null;
  return { parsed, group, skipped, semverSuggestion };
}
