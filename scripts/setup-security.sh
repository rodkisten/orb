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

# Bootstrap can run before the Worker exists. Secrets are generated locally
# and uploaded only after a verified, separately approved deployment.
WORKER_EXISTS=false
if api GET "accounts/$ACCOUNT_ID/workers/scripts/$WORKER" >/dev/null 2>&1; then
  WORKER_EXISTS=true
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

# Create a dedicated, fail-closed Access application on first run.
# Only the explicitly supplied operator email is allowed.
APPS_JSON="$(api GET "accounts/$ACCOUNT_ID/access/apps")"
APP_ID="$(jq -r '.result[] | select(.name == "orb · API") | .id' <<<"$APPS_JSON" | head -n 1)"
if [[ -z "$APP_ID" ]]; then
  read -rp 'Protected API hostname [api.orb.migos.club]: ' APP_DOMAIN
  APP_DOMAIN="${APP_DOMAIN:-api.orb.migos.club}"
  [[ "$APP_DOMAIN" =~ ^[a-zA-Z0-9.-]+$ ]] || { echo 'Invalid hostname' >&2; exit 1; }
  read -rp 'Authorized operator email: ' OPERATOR_EMAIL
  OPERATOR_EMAIL="${OPERATOR_EMAIL//$'\\r'/}"
  if [[ "$OPERATOR_EMAIL" != *@*.* || "$OPERATOR_EMAIL" == *[[:space:]]* ]]; then
    echo 'Invalid operator email' >&2
    exit 1
  fi
  echo "Creating a private Access app for $APP_DOMAIN with email-only allow policy."
  APP_PAYLOAD="$(jq -nc --arg domain "$APP_DOMAIN" --arg email "$OPERATOR_EMAIL" '{
    name:"orb · API",type:"self_hosted",domain:$domain,
    session_duration:"24h",app_launcher_visible:false,
    policies:[{name:"orb operators",decision:"allow",include:[{email:{email:$email}}]}]
  }')"
  APP_JSON="$(api POST "accounts/$ACCOUNT_ID/access/apps" --data "$APP_PAYLOAD")"
  APP_ID="$(jq -er '.result.id' <<<"$APP_JSON")"
fi
ACCESS_APP="$(api GET "accounts/$ACCOUNT_ID/access/apps/$APP_ID")"
AUD="$(jq -er '.result.aud' <<<"$ACCESS_APP")"
APP_DOMAIN="$(jq -er '.result.domain' <<<"$ACCESS_APP")"
printf '✔ Access application: %s (%s)\\n' "$APP_ID" "$APP_DOMAIN"

if [[ "$WORKER_EXISTS" != true ]]; then
  {
    printf 'CF_ACCESS_TEAM_DOMAIN=%q\\n' "$TEAM_DOMAIN"
    printf 'CF_ACCESS_AUD=%q\\n' "$AUD"
    printf 'CF_ACCESS_APP_ID=%q\\n' "$APP_ID"
    printf 'CF_ACCESS_APP_DOMAIN=%q\\n' "$APP_DOMAIN"
  } >> "$SECRETS_FILE"
  cat <<MESSAGE
✔ Access application created or reused.
✔ Secrets preserved in $SECRETS_FILE (mode 600).
ℹ orb-api Worker does not exist yet, so no secrets were uploaded.
Next: verify the build, apply D1 migration, deploy behind Access,
then rerun this script to upload secrets. Do not expose workers.dev publicly.
MESSAGE
  exit 0
fi

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
