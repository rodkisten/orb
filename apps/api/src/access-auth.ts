/**
 * Cloudflare Access JWT validation for browser read endpoints.
 * Fail closed until both team domain and application AUD are configured.
 * No browser token is stored in localStorage or embedded in a URL.
 */
export type AccessBindings = {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
};

type Claims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  sub?: string;
};

type JwkKey = JsonWebKey & {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
};

function decodePart(part: string): unknown {
  const padded = part
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(part.length / 4) * 4, "=");
  return JSON.parse(atob(padded));
}

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

export async function accessIdentity(
  request: Request,
  env: AccessBindings,
): Promise<string | null> {
  const issuer = validTeamDomain(env.CF_ACCESS_TEAM_DOMAIN ?? "");
  const audience = env.CF_ACCESS_AUD;
  if (!issuer || !audience) return null;

  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt || jwt.length > 8192) return null;
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;

  try {
    const header = decodePart(parts[0]) as { alg?: string; kid?: string };
    const claims = decodePart(parts[1]) as Claims;
    if (header.alg !== "RS256" || !header.kid || !claims.sub) return null;
    if (
      claims.iss !== issuer ||
      !(Array.isArray(claims.aud)
        ? claims.aud.includes(audience)
        : claims.aud === audience)
    )
      return null;
    const now = Math.floor(Date.now() / 1000);
    if (
      !claims.exp ||
      claims.exp <= now ||
      (claims.nbf !== undefined && claims.nbf > now)
    )
      return null;

    const response = await fetch(issuer + "/cdn-cgi/access/certs", {
      redirect: "error",
    });
    if (!response.ok) return null;
    const keys = (await response.json()) as { keys?: JwkKey[] };
    const jwk = keys.keys?.find(
      (key) =>
        key.kid === header.kid &&
        key.kty === "RSA" &&
        (!key.use || key.use === "sig") &&
        (!key.alg || key.alg === "RS256"),
    );
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signature = Uint8Array.from(
      atob(
        parts[2]
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(Math.ceil(parts[2].length / 4) * 4, "="),
      ),
      (char) => char.charCodeAt(0),
    );
    const message = new TextEncoder().encode(parts[0] + "." + parts[1]);
    return (await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature,
      message,
    ))
      ? claims.sub
      : null;
  } catch {
    return null;
  }
}
