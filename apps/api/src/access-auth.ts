import { createRemoteJWKSet, jwtVerify, errors } from "jose";

export type AccessBindings = {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
};

function validTeamDomain(value: string): string | null {
  try {
    const url = new URL(
      value.startsWith("https://") ? value : "https://" + value,
    );
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function keysFor(issuer: string) {
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer), {
      timeoutDuration: 5000,
      cacheMaxAge: 600000,
      cooldownDuration: 30000,
    });
    keySets.set(issuer, keys);
  }
  return keys;
}

export async function accessIdentity(
  request: Request,
  env: AccessBindings,
  report: (reason: string) => void = () => {},
): Promise<string | null> {
  const reject = (reason: string): null => {
    report(reason);
    return null;
  };
  const issuer = validTeamDomain(env.CF_ACCESS_TEAM_DOMAIN ?? "");
  const audience = env.CF_ACCESS_AUD;
  if (!issuer || !audience) return reject("missing_or_invalid_config");

  // Service bindings may omit the Access assertion header. The browser's
  // application cookie is also a signed JWT and must pass identical checks.
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("CF_Authorization="))
    ?.slice("CF_Authorization=".length);
  const jwt = request.headers.get("cf-access-jwt-assertion") || cookie;
  if (!jwt || jwt.length > 8192)
    return reject("missing_or_oversized_assertion");
  try {
    const { payload } = await jwtVerify(jwt, keysFor(issuer), {
      issuer,
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "exp"],
    });
    return typeof payload.sub === "string" && payload.sub.length > 0
      ? payload.sub
      : reject("missing_subject");
  } catch (error) {
    if (error instanceof errors.JOSEError) return reject(error.code);
    return reject(
      error instanceof TypeError
        ? "jwks_fetch_type_error"
        : "jwt_validation_exception",
    );
  }
}
