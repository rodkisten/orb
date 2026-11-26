import { readFileSync, writeFileSync } from "node:fs";
// Strip JSONC comments and trailing commas outside quoted strings.
function parseJsonc(source) {
  const tokens = /"(?:\\[\s\S]|[^"\\])*"|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g;
  const clean = source.replace(tokens, token => token.startsWith('"') ? token : token.replace(/[^\r\n]/g, " "));
  return JSON.parse(clean.replace(/"(?:\\[\s\S]|[^"\\])*"|,(?=\s*[}\]])/g, token => token === "," ? "" : token));
}
const pr = process.argv[2];
if (!/^[1-9][0-9]*$/.test(pr ?? "")) throw Error("Invalid PR number");
for (const app of ["api", "web"]) {
  const file = new URL("../apps/" + app + "/wrangler.jsonc", import.meta.url);
  const config = parseJsonc(readFileSync(file, "utf8"));
  config.name = "orb-" + app + "-pr-" + pr;
  config.routes = [
    {
      pattern: "pr" + pr + (app === "api" ? ".api" : "") + ".orb.migos.club",
      custom_domain: true,
    },
  ];
  config.workers_dev = false;
  config.preview_urls = false;
  if (app === "api") {
    config.main = "src/preview.ts";
    delete config.triggers;
    delete config.queues;
  } else
    config.services = config.services.map((s) =>
      s.binding === "API" ? { ...s, service: "orb-api-pr-" + pr } : s,
    );
  writeFileSync(
    new URL("./wrangler.preview.json", file),
    JSON.stringify(config, null, 2) + "\n",
  );
}
