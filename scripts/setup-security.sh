#!/usr/bin/env bash
# Configure orb secrets without exposing them in shell history or CI logs.
set -Eeuo pipefail
umask 077

ACCOUNT_ID="549830258550a5d0ada2e37040751904"
WORKER="orb-api"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SECRETS_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/orb"
SECRETS_FILE="$SECRETS_DIR/security.env"
API_DIR="$ROOT/apps/api"

for cmd in curl jq openssl pnpm; do
  command -v "$cmd" >/dev/null || { printf 'Missing dependency: %s\n' "$cmd" >&2; exit 1; }
done

printf '\n🪐 orb · Security bootstrap\n'
printf 'Cloudflare account: %s\nWorker: %s\n' "$ACCOUNT_ID" "$WORKER"

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  read -rsp 'Cloudflare API token (not echoed): ' CLOUDFLARE_API_TOKEN
  printf '\n'
fi
export CLOUDFLARE_API_TOKEN
[[ -n "$CLOUDFLARE_API_TOKEN" ]] || { echo 'Missing Cloudflare API token' >&2; exit 1; }

api() {
  local method="$1" endpoint="$2"
  shift 2
  curl --fail-with-body --silent --show-error --retry 2 \
    -X "$method" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H 'Content-Type: application/json' "$@" \
    "https://api.cloudflare.com/client/v4/$endpoint"
}

# Never create or publish a Worker as a side effect of secret configuration.
if ! api GET "accounts/$ACCOUNT_ID/workers/scripts/$WORKER" >/dev/null 2>&1; then
  cat >&2 <<'MESSAGE'
The orb-api Worker does not exist or is inaccessible.
Stop: verify the build, apply D1 migrations, and deploy only to a protected
hostname before uploading secrets. No Worker was created.
MESSAGE
  exit 2
fi

mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"
if [[ -f "$SECRETS_FILE" ]]; then
  # Existing secrets are reused so GitHub and Cloudflare never diverge.
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
else
  GITHUB_WEBHOOK_SECRET="$(openssl rand -hex 32)"
  ORB_INGEST_TOKEN="$(openssl rand -hex 32)"
  {
    printf 'GITHUB_WEBHOOK_SECRET=%q\n' "$GITHUB_WEBHOOK_SECRET"
    printf 'ORB_INGEST_TOKEN=%q\n' "$ORB_INGEST_TOKEN"
  } > "$SECRETS_FILE"
  chmod 600 "$SECRETS_FILE"
fi

TEAM_JSON="$(api GET "accounts/$ACCOUNT_ID/access/organizations")"
TEAM_DOMAIN="$(jq -er '.result.auth_domain' <<<"$TEAM_JSON")"
[[ "$TEAM_DOMAIN" =~ ^[a-z0-9-]+\.cloudflareaccess\.com$ ]] || {
  echo 'Unexpected Cloudflare Access team domain' >&2
  exit 1
}

APPS_JSON="$(api GET "accounts/$ACCOUNT_ID/access/apps")"
echo
echo 'Cloudflare Access applications (orb-specific application required):'
jq -r '.result[] | [.name, (.domain // ""), (.aud // "")] | @tsv' <<<"$APPS_JSON"
echo
read -rp 'orb Access application ID (create a dedicated private app first): ' ACCESS_APP_ID
[[ "$ACCESS_APP_ID" =~ ^[a-fA-F0-9-]{36}$ ]] || { echo 'Invalid application ID' >&2; exit 1; }

ACCESS_APP="$(api GET "accounts/$ACCOUNT_ID/access/apps/$ACCESS_APP_ID")"
AUD="$(jq -er '.result.aud' <<<"$ACCESS_APP")"
APP_NAME="$(jq -er '.result.name' <<<"$ACCESS_APP")"
APP_DOMAIN="$(jq -er '.result.domain' <<<"$ACCESS_APP")"
if [[ ! "$APP_NAME" =~ [Oo][Rr][Bb] ]]; then
  echo 'Selected application is not orb-specific. Refusing to reuse another app.' >&2
  exit 1
fi
printf 'Selected Access application: %s (%s)\n' "$APP_NAME" "$APP_DOMAIN"
read -rp 'Confirm this application is restricted to authorized operators? [yes/N] ' CONFIRM
[[ "$CONFIRM" == yes ]] || { echo 'Cancelled.'; exit 1; }

upload() {
  local name="$1" value="$2"
  # Wrangler secret put receives the secret through stdin; never use -x or echo values.
  printf '%s' "$value" | (cd "$API_DIR" && pnpm exec wrangler secret put "$name" --name "$WORKER")
  printf '✔ Uploaded %s\n' "$name"
}

upload GITHUB_WEBHOOK_SECRET "$GITHUB_WEBHOOK_SECRET"
upload ORB_INGEST_TOKEN "$ORB_INGEST_TOKEN"
upload CF_ACCESS_TEAM_DOMAIN "$TEAM_DOMAIN"
upload CF_ACCESS_AUD "$AUD"

cat <<MESSAGE

✔ Worker secrets configured.
✔ Secrets preserved at $SECRETS_FILE (mode 600; do not commit).
⚠ Configure the GitHub App webhook with the SAME GITHUB_WEBHOOK_SECRET.
  Retrieve it locally with:
  source "$SECRETS_FILE"; printf '%s\\n' "\$GITHUB_WEBHOOK_SECRET"

⚠ The Worker is NOT deployed by this script.
⚠ Access policy, hostname routing, project authorization, and CI verification
  must be completed before public exposure.
MESSAGE
