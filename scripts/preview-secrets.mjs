import { writeFileSync } from "node:fs";
const keys = [
  "CF_ACCESS_AUD",
  "CF_ACCESS_TEAM_DOMAIN",
  "ORB_GITHUB_APP_ID",
  "ORB_GITHUB_APP_INSTALLATION_ID",
  "ORB_GITHUB_APP_PRIVATE_KEY",
  "ORB_CI_READ_TOKEN",
  "ORB_CI_REPOSITORIES",
];
for (const k of keys.slice(0, 2))
  if (!process.env[k]) throw Error("Missing " + k);
writeFileSync(
  process.argv[2],
  JSON.stringify(
    Object.fromEntries(
      keys.filter((k) => process.env[k]).map((k) => [k, process.env[k]]),
    ),
  ),
  { mode: 0o600 },
);
