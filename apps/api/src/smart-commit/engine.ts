import { classifyMessage, validateSuggestion } from "./policy";
import { screenDiff, type DiffFile } from "./sanitize";
import {
  evaluateChangelog,
  type ChangelogAdapter,
  type ChangelogRule,
} from "./changelog";

export type GenerationProvider = (input: {
  subject: string;
  files: readonly DiffFile[];
}) => Promise<string>;

export type SmartCommitInput = {
  original: string;
  files: readonly DiffFile[];
  rules: readonly ChangelogRule[];
};

export async function generateSmartCommit(
  input: SmartCommitInput,
  dependencies: {
    generate: GenerationProvider;
    changelog: ChangelogAdapter;
    lint: (subject: string) => Promise<boolean>;
  },
) {
  const policy = classifyMessage(input.original);
  if (!policy.eligible)
    return { status: "unchanged" as const, message: input.original };
  const files = screenDiff(input.files);
  const suggestion = await dependencies.generate({
    subject: policy.subject,
    files,
  });
  const message = validateSuggestion(input.original, suggestion);
  if (message === null || !(await dependencies.lint(suggestion.trim()))) {
    return { status: "rejected" as const, message: input.original };
  }
  const changelog = await evaluateChangelog(
    suggestion.trim(),
    input.rules,
    dependencies.changelog,
  );
  return { status: "suggested" as const, message, changelog };
}
