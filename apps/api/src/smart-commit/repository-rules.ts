/** Resolve configuration at an immutable repository revision, without executing repository code. */
export type ConfigReader = (
  path: string,
  revision: string,
) => Promise<string | null>;

export type RuleSource = {
  kind: "orb" | "git-cliff" | "commitlint" | "conventional-changelog";
  path: string;
  content: string;
};

const candidates = [
  ["orb", ".orb.yml"],
  ["orb", ".orb.yaml"],
  ["git-cliff", "cliff.toml"],
  ["git-cliff", ".cliff.toml"],
  ["commitlint", ".commitlintrc.json"],
  ["commitlint", ".commitlintrc.yaml"],
  ["commitlint", ".commitlintrc.yml"],
  ["commitlint", "commitlint.config.js"],
  ["commitlint", "commitlint.config.cjs"],
  ["commitlint", "commitlint.config.mjs"],
  ["commitlint", "commitlint.config.ts"],
  ["conventional-changelog", ".versionrc.json"],
  ["conventional-changelog", ".versionrc"],
  ["conventional-changelog", "package.json"],
] as const;

export async function discoverRepositoryRules(
  read: ConfigReader,
  revision: string,
) {
  if (!/^[a-f0-9]{40}$/i.test(revision))
    throw new Error("Expected immutable commit SHA");
  const sources: RuleSource[] = [];
  for (const [kind, path] of candidates) {
    const content = await read(path, revision);
    if (content === null) continue;
    if (new TextEncoder().encode(content).length > 65536) {
      throw new Error("Repository configuration exceeds size limit: " + path);
    }
    sources.push({ kind, path, content });
  }
  return { revision, sources, fallbackPreset: "conventionalcommits" as const };
}
