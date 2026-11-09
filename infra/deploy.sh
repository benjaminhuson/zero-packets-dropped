#!/usr/bin/env bash
# Deploys Stride to the team's resource group.
#
#   ./infra/deploy.sh infra   Azure resources + Microsoft sign-in (run once, and after changing main.bicep)
#   ./infra/deploy.sh app     build the front end and backend and push the code
#   ./infra/deploy.sh all     both (default)
#
# Before running:  az login --tenant <tenant-domain>  and  az account set --subscription "<subscription-name>"
# Settings come from infra/.env (see infra/.env.example). The script never prints secrets or ids.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STEP="${1:-all}"
[ -f "$ROOT/infra/.env" ] || { echo "Create infra/.env from infra/.env.example first."; exit 1; }
set -a; source "$ROOT/infra/.env"; set +a
: "${TEAM_NUMBER:?set TEAM_NUMBER in infra/.env}" "${RESOURCE_GROUP:?set RESOURCE_GROUP in infra/.env}"
LOCATION="${LOCATION:-uksouth}"
[[ "$TEAM_NUMBER" =~ ^[0-9]{2}$ ]] || { echo "TEAM_NUMBER must be two digits, e.g. 03"; exit 1; }
[[ "$LOCATION" == "uksouth" || "$LOCATION" == "italynorth" ]] || { echo "LOCATION must be uksouth or italynorth"; exit 1; }

APP_REG_NAME="team${TEAM_NUMBER}-stride"
STATE="$ROOT/infra/.deploy"   # git-ignored: web app name from the last infra run
mkdir -p "$STATE"

az account show -o none 2>/dev/null || { echo "Run az login --tenant <tenant-domain> first."; exit 1; }
az group show -n "$RESOURCE_GROUP" -o none || { echo "Can't see resource group $RESOURCE_GROUP. Check the subscription."; exit 1; }

deploy_bicep() { # $1 = client id (may be empty)
  local name; name="$(cat "$STATE/webapp" 2>/dev/null || true)"
  local session="" admin=""
  if [ -n "$name" ]; then # reuse secrets so redeploys don't sign everyone out
    session="$(az webapp config appsettings list -g "$RESOURCE_GROUP" -n "$name" --query "[?name=='SESSION_SECRET'].value | [0]" -o tsv 2>/dev/null || true)"
    admin="$(az webapp config appsettings list -g "$RESOURCE_GROUP" -n "$name" --query "[?name=='ADMIN_TOKEN'].value | [0]" -o tsv 2>/dev/null || true)"
  fi
  [ -n "$session" ] || session="$(openssl rand -base64 48 | tr -d '\n')"
  [ -n "$admin" ] || admin="$(openssl rand -hex 24)"
  local me; me="$(az ad signed-in-user show --query id -o tsv 2>/dev/null || true)"

  az deployment group create -g "$RESOURCE_GROUP" -n stride -f "$ROOT/infra/main.bicep" -o none \
    -p teamNumber="$TEAM_NUMBER" location="$LOCATION" entraClientId="$1" \
       sessionSecret="$session" adminToken="$admin" deployerPrincipalId="$me"
  az deployment group show -g "$RESOURCE_GROUP" -n stride --query properties.outputs.webAppName.value -o tsv > "$STATE/webapp"
  az deployment group show -g "$RESOURCE_GROUP" -n stride --query properties.outputs.hostName.value -o tsv > "$STATE/host"
}

ensure_app_registration() { # prints the client id
  local host; host="$(cat "$STATE/host")"
  local redirect="https://${host}/.auth/login/aad/callback"
  local id; id="$(az ad app list --display-name "$APP_REG_NAME" --query "[0].appId" -o tsv)"
  if [ -z "$id" ]; then
    id="$(az ad app create --display-name "$APP_REG_NAME" --sign-in-audience AzureADMyOrg \
      --web-redirect-uris "$redirect" --enable-id-token-issuance true --query appId -o tsv)"
  else
    az ad app update --id "$id" --web-redirect-uris "$redirect" --enable-id-token-issuance true -o none
  fi
  az ad sp show --id "$id" -o none 2>/dev/null || az ad sp create --id "$id" -o none
  echo "$id"
}

infra() {
  echo "1/3 Azure resources ($LOCATION)..."
  local existing; existing="$(az ad app list --display-name "$APP_REG_NAME" --query "[0].appId" -o tsv)"
  deploy_bicep "$existing"
  echo "2/3 App registration $APP_REG_NAME..."
  local id; id="$(ensure_app_registration)"
  echo "3/3 Microsoft sign-in..."
  deploy_bicep "$id"
  echo "Infra ready: https://$(cat "$STATE/host")"
}

app() {
  local name; name="$(cat "$STATE/webapp" 2>/dev/null || true)"
  [ -n "$name" ] || { echo "Run ./infra/deploy.sh infra first."; exit 1; }
  local pkg zip; pkg="$(mktemp -d)"; zip="${pkg}.zip"
  echo "Building front end..."
  (cd "$ROOT/stride" && npm ci --no-audit --no-fund && npm run build)
  echo "Building backend..."
  (cd "$ROOT/backend" && npm ci --no-audit --no-fund && npm run build)
  cp -r "$ROOT/backend/dist" "$ROOT/backend/package.json" "$ROOT/backend/package-lock.json" "$pkg/"
  cp -r "$ROOT/stride/dist" "$pkg/public"
  (cd "$pkg" && npm ci --omit=dev --no-audit --no-fund && zip -qr "$zip" .)
  echo "Uploading..."
  az webapp deploy -g "$RESOURCE_GROUP" -n "$name" --src-path "$zip" --type zip -o none
  rm -rf "$pkg" "$zip"
  echo "Deployed: https://$(cat "$STATE/host")"
}

case "$STEP" in
  infra) infra ;;
  app) app ;;
  all) infra; app ;;
  *) echo "Usage: $0 [infra|app|all]"; exit 1 ;;
esac
