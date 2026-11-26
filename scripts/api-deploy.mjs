import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLogger } from "./logger.mjs";

const log = createLogger("ORB API DEPLOY");

const host = "api.orb.migos.club";
const projectRepositories = [
  "rodverse/rodverse",
  "rodkisten/orb",
  "rodkisten/photointel",
  "rodkisten/userscripts-cf",
  "rodkisten/shell",
  "rodkisten/jardim",
  "rodkisten/ast-explorer",
  "rodkisten/ejc",
  "rodkisten/github",
  "rodkisten/rodtui",
  "rodkisten/rodlog",
  "rodkisten/zsh",
];
process.env.ORB_CI_REPOSITORIES = [
  ...new Set([
    ...projectRepositories,
    ...(process.env.ORB_CI_REPOSITORIES || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ]),
]
  .sort()
  .join(",");
const workerKeys = [
  "ORB_GITHUB_APP_ID",
  "ORB_GITHUB_APP_INSTALLATION_ID",
  "ORB_GITHUB_APP_PRIVATE_KEY",
  "CF_ACCESS_AUD",
  "CF_ACCESS_TEAM_DOMAIN",
  "ORB_INGEST_TOKEN",
  "ORB_WEBHOOK_SECRET",
  "ORB_CI_READ_TOKEN",
  "ORB_CI_REPOSITORIES",
];
const githubKeys = [
  "ORB_GITHUB_APP_ID",
  "ORB_GITHUB_APP_INSTALLATION_ID",
  "ORB_GITHUB_APP_PRIVATE_KEY",
];
const optionalKeys = new Set([...githubKeys, "ORB_CI_READ_TOKEN"]);
const required = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CF_ACCESS_APP_ID",
  "CF_ACCESS_CLIENT_ID",
  "CF_ACCESS_CLIENT_SECRET",
  ...workerKeys.filter((key) => !optionalKeys.has(key)),
];

async function resolveAccessApp() {
  const base =
    "https://api.cloudflare.com/client/v4/accounts/" +
    process.env.CLOUDFLARE_ACCOUNT_ID;
  const response = await fetch(
    base + "/access/apps?exact=true&domain=" + encodeURIComponent(host),
    {
      headers: { Authorization: "Bearer " + process.env.CLOUDFLARE_API_TOKEN },
      signal: AbortSignal.timeout(20000),
    },
  );
  const data = await response.json();
  if (!response.ok || !data.success || !Array.isArray(data.result))
    throw Error("Access application discovery failed: " + response.status);
  const matches = data.result.filter(
    (app) =>
      app.domain === host && app.type === "self_hosted" && app.id && app.aud,
  );
  if (matches.length !== 1)
    throw Error(
      "Expected exactly one Access application for " +
        host +
        "; found " +
        matches.length,
    );
  process.env.CF_ACCESS_APP_ID = matches[0].id;
  process.env.CF_ACCESS_AUD = matches[0].aud;
}

async function inspectAccess() {
  const api =
    "https://api.cloudflare.com/client/v4/accounts/" +
    process.env.CLOUDFLARE_ACCOUNT_ID;

  async function get(path) {
    const response = await fetch(api + path, {
      headers: { Authorization: "Bearer " + process.env.CLOUDFLARE_API_TOKEN },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw Error(`Access preflight failed (${response.status})`);
    const payload = await response.json();
    if (!payload.success)
      throw Error("Access preflight returned an unsuccessful response");
    return payload.result;
  }

  const path =
    "/access/apps/" + encodeURIComponent(process.env.CF_ACCESS_APP_ID);
  const [app, policies] = await Promise.all([
    get(path),
    get(path + "/policies"),
  ]);

  if (
    app.domain !== host ||
    app.aud !== process.env.CF_ACCESS_AUD ||
    app.type !== "self_hosted"
  ) {
    throw Error(
      "Access application does not match the Orb API hostname and audience",
    );
  }

  const isRestricted = (policy, decision, selector) =>
    policy.decision === decision &&
    policy.include?.length > 0 &&
    policy.include.every(
      (rule) => Object.keys(rule).length === 1 && Object.hasOwn(rule, selector),
    );

  if (
    !policies.some((policy) => isRestricted(policy, "allow", "email")) ||
    !policies.some((policy) =>
      isRestricted(policy, "non_identity", "service_token"),
    ) ||
    policies.some(
      (policy) =>
        !isRestricted(policy, "allow", "email") &&
        !isRestricted(policy, "non_identity", "service_token") &&
        policy.decision !== "deny",
    )
  ) {
    throw Error(
      "Orb Access requires explicit operator emails and a service-token policy for the smoke test",
    );
  }
}

async function smoke(ctx) {
  const url = "https://" + host + "/v1/health";

  for (let attempt = 0; attempt < 12; attempt++) {
    ctx.update(`tentativa ${attempt + 1}/12`);

    const anonymous = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);
    if (anonymous?.ok)
      throw Error("Orb API unexpectedly allows anonymous access");

    const authenticated = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
      headers: {
        "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID,
        "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET,
      },
    }).catch(() => null);

    ctx.update(
      `tentativa ${attempt + 1}/12 · anonymous=${anonymous?.status ?? "network error"} · authenticated=${authenticated?.status ?? "network error"} · content-type=${authenticated?.headers.get("content-type")?.split(";")[0] ?? "unknown"}`,
    );
    if (
      authenticated?.ok &&
      anonymous &&
      [302, 401, 403].includes(anonymous.status)
    ) {
      const result = await authenticated.json().catch(() => null);
      if (result?.status === "ok" && result.service === "orb-api") {
        return;
      }
    }

    if (authenticated?.status === 500) {
      const body = await authenticated.text().catch(() => "");
      const code = body.match(
        /(?:error code[:\s]*|Error\s+)(10\d{2}|11\d{2})/i,
      )?.[1];
      ctx.update(
        "HTTP 500 · cf-ray=" +
          (authenticated.headers.get("cf-ray") ?? "unknown") +
          " · edge error=" +
          (code ?? "unknown"),
      );
    }
    await authenticated?.body?.cancel().catch(() => {});
    await anonymous?.body?.cancel().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw Error("Protected Orb health check did not pass");
}

function runWrangler(...args) {
  try {
    execFileSync(
      "pnpm",
      ["--filter", "@orb/api", "exec", "wrangler", ...args],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (err) {
    const output = [err.stderr?.toString(), err.stdout?.toString()]
      .filter(Boolean)
      .join("\n")
      .trim();
    const error = new Error(
      `Wrangler command failed: wrangler ${args.join(" ")}`,
    );
    error.stderr = output;
    throw error;
  }
}

async function ensureQueues() {
  const base =
    "https://api.cloudflare.com/client/v4/accounts/" +
    process.env.CLOUDFLARE_ACCOUNT_ID;
  const headers = {
    Authorization: "Bearer " + process.env.CLOUDFLARE_API_TOKEN,
    "Content-Type": "application/json",
  };
  for (const name of ["orb-events", "orb-events-dlq"]) {
    const response = await fetch(
      base + "/queues?name=" + encodeURIComponent(name),
      { headers },
    );
    const payload = await response.json();
    if (!response.ok || !payload.success || !Array.isArray(payload.result))
      throw Error("Queue discovery failed: " + name);
    if (payload.result.some((queue) => queue.queue_name === name)) continue;
    const created = await fetch(base + "/queues", {
      method: "POST",
      headers,
      body: JSON.stringify({ queue_name: name }),
    });
    const result = await created.json();
    if (!created.ok || !result.success)
      throw Error("Queue creation failed: " + name);
  }
}

async function bootstrapCredentials() {
  log.requireEnv(["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]);
  const base =
    "https://api.cloudflare.com/client/v4/accounts/" +
    process.env.CLOUDFLARE_ACCOUNT_ID;
  async function cf(path, method = "GET", body) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Authorization: "Bearer " + process.env.CLOUDFLARE_API_TOKEN,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success)
      throw Error(
        "Cloudflare bootstrap failed: " +
          method +
          " " +
          path +
          " (" +
          response.status +
          ")",
      );
    return payload.result;
  }
  const app = await cf(
    "/access/apps/" + encodeURIComponent(process.env.CF_ACCESS_APP_ID),
  );
  process.env.CF_ACCESS_AUD ||= app.aud;
  const missing = [
    "ORB_INGEST_TOKEN",
    "ORB_WEBHOOK_SECRET",
    "CF_ACCESS_CLIENT_ID",
    "CF_ACCESS_CLIENT_SECRET",
  ].filter((key) => !process.env[key]);
  if (!missing.length) {
    const tokens = await cf("/access/service_tokens");
    const token = tokens.find(
      (item) => item.client_id === process.env.CF_ACCESS_CLIENT_ID,
    );
    if (!token)
      throw Error(
        "Configured Access Client ID does not match an account service token",
      );
    const path = "/access/apps/" + app.id + "/policies";
    const policies = await cf(path);
    if (
      !policies.some(
        (policy) =>
          policy.decision === "non_identity" &&
          policy.include?.some(
            (rule) => rule.service_token?.token_id === token.id,
          ),
      )
    ) {
      await cf(path, "POST", {
        name: "Orb bootstrap service authentication",
        decision: "non_identity",
        include: [{ service_token: { token_id: token.id } }],
      });
    }
    return;
  }
  if (!process.env.GH_TOKEN)
    throw Error(
      "Missing ORB_BOOTSTRAP_GITHUB_TOKEN: a GitHub credential with environment secrets write access is required to persist generated keys safely.",
    );
  const save = (key, value) => {
    if (!value) throw Error("Empty generated credential: " + key);
    execFileSync(
      "gh",
      ["secret", "set", key, "-R", "rodkisten/orb", "-e", "production"],
      { input: value, stdio: ["pipe", "ignore", "pipe"] },
    );
    process.env[key] = value;
  };
  for (const key of ["ORB_INGEST_TOKEN", "ORB_WEBHOOK_SECRET"]) {
    if (!process.env[key]) save(key, randomBytes(32).toString("hex"));
  }
  if (
    !process.env.CF_ACCESS_CLIENT_ID ||
    !process.env.CF_ACCESS_CLIENT_SECRET
  ) {
    const tokens = await cf("/access/service_tokens");
    if (tokens.some((token) => token.name === "orb-bootstrap"))
      throw Error(
        "Existing orb-bootstrap service token found; recover its stored credentials or explicitly rotate it. No automatic rotation.",
      );
    const token = await cf("/access/service_tokens", "POST", {
      name: "orb-bootstrap",
      duration: "8760h",
    });
    save("CF_ACCESS_CLIENT_ID", token.client_id);
    save("CF_ACCESS_CLIENT_SECRET", token.client_secret);
    const policies = await cf("/access/apps/" + app.id + "/policies");
    if (
      !policies.some(
        (policy) =>
          policy.decision === "non_identity" &&
          policy.include?.some(
            (rule) => rule.service_token?.token_id === token.id,
          ),
      )
    ) {
      await cf("/access/apps/" + app.id + "/policies", "POST", {
        name: "Orb bootstrap smoke",
        decision: "non_identity",
        include: [{ service_token: { token_id: token.id } }],
      });
    }
  }
}

async function deploy() {
  await log.step("Discover Orb Access application", async () => {
    log.requireEnv(["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]);
    await resolveAccessApp();
  });
  if (process.env.ORB_BOOTSTRAP === "1")
    await log.step("Provision missing credentials", bootstrapCredentials);

  await log.step("Validate environment variables", () => {
    log.requireEnv(required);
  });

  await log.step("Resolve GitHub integration credentials", () => {
    const complete = githubKeys.every((key) => process.env[key]);
    if (!complete) {
      for (const key of githubKeys) delete process.env[key];
      console.log(
        "GitHub App credentials unavailable; preserving existing Worker bindings.",
      );
    }
    if (!complete && !process.env.ORB_CI_READ_TOKEN) {
      console.log(
        "GitHub integration requires existing App bindings or a dedicated read token; core deployment continues.",
      );
    }
  });

  await log.step("Inspect Cloudflare Access policies", () => inspectAccess());

  if (process.env.ORB_BOOTSTRAP === "1") {
    await log.step("Ensure queues exist", ensureQueues);
  }

  const temporary = mkdtempSync(join(tmpdir(), "orb-deploy-"));
  try {
    const secrets = join(temporary, "secrets.json");
    writeFileSync(
      secrets,
      JSON.stringify(
        Object.fromEntries(
          workerKeys
            .filter((key) => process.env[key])
            .map((key) => [key, process.env[key]]),
        ),
      ),
      { mode: 0o600 },
    );

    await log.step("Apply remote D1 migrations (orb-events)", () => {
      runWrangler("d1", "migrations", "apply", "orb-events", "--remote");
    });

    await log.step("Deploy Worker & sync secrets", () => {
      runWrangler("deploy", "--keep-vars", "--secrets-file", secrets);
    });

    await log.step(`Verify health check (${host})`, (ctx) => smoke(ctx));

    log.summary();
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

deploy().catch((error) => {
  log.fail(error);
});
