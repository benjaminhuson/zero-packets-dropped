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
ENABLE_TEAMS="${ENABLE_TEAMS:-true}"   # Stride bot + Teams channel
MEETINGS="${MEETINGS:-link}"           # link, or graph once admin consent for Calendars.ReadWrite is granted
BOT_LOCATION="${BOT_LOCATION:-global}"
[[ "$ENABLE_TEAMS" =~ ^(true|false)$ ]] || { echo "ENABLE_TEAMS must be true or false"; exit 1; }
[[ "$MEETINGS" =~ ^(link|graph)$ ]] || { echo "MEETINGS must be link or graph"; exit 1; }
[[ "$TEAM_NUMBER" =~ ^[0-9]{2}$ ]] || { echo "TEAM_NUMBER must be two digits, e.g. 03"; exit 1; }

APP_REG_NAME="team${TEAM_NUMBER}-stride"
STATE="$ROOT/infra/.deploy"   # git-ignored: web app name from the last infra run
mkdir -p "$STATE"

az account show -o none 2>/dev/null || { echo "Run az login --tenant <tenant-domain> first."; exit 1; }
az group show -n "$RESOURCE_GROUP" -o none || { echo "Can't see resource group $RESOURCE_GROUP. Check the subscription."; exit 1; }

# Region and plan size: infra/.env if set there, otherwise whatever the last deployment used (Cloud Shell without
# storage forgets infra/.env, and redeploying to a different region would clash), otherwise the defaults.
previous() { az deployment group show -g "$RESOURCE_GROUP" -n stride --query "properties.parameters.$1.value" -o tsv 2>/dev/null || true; }
LOCATION="${LOCATION:-$(previous location)}"; LOCATION="${LOCATION:-uksouth}"
APP_SKU="${APP_SKU:-$(previous appServiceSku)}"; APP_SKU="${APP_SKU:-B1}"
[[ "$LOCATION" == "uksouth" || "$LOCATION" == "italynorth" ]] || { echo "LOCATION must be uksouth or italynorth"; exit 1; }
[[ "$APP_SKU" =~ ^(F1|B1|S1|P0v3)$ ]] || { echo "APP_SKU must be F1, B1, S1 or P0v3"; exit 1; }
echo "Region $LOCATION, App Service plan $APP_SKU."

# Recover the web app's name and address from the last deployment if this machine has lost infra/.deploy.
if [ ! -s "$STATE/webapp" ]; then
  az deployment group show -g "$RESOURCE_GROUP" -n stride --query properties.outputs.webAppName.value -o tsv > "$STATE/webapp" 2>/dev/null || true
  az deployment group show -g "$RESOURCE_GROUP" -n stride --query properties.outputs.hostName.value -o tsv > "$STATE/host" 2>/dev/null || true
fi

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
    -p teamNumber="$TEAM_NUMBER" location="$LOCATION" appServiceSku="$APP_SKU" entraClientId="$1" \
       enableTeams="$ENABLE_TEAMS" meetings="$MEETINGS" botLocation="$BOT_LOCATION" \
       sessionSecret="$session" adminToken="$admin" deployerPrincipalId="$me"
  az deployment group show -g "$RESOURCE_GROUP" -n stride --query properties.outputs.webAppName.value -o tsv > "$STATE/webapp"
  az deployment group show -g "$RESOURCE_GROUP" -n stride --query properties.outputs.hostName.value -o tsv > "$STATE/host"
  az deployment group show -g "$RESOURCE_GROUP" -n stride --query properties.outputs.botPrincipalId.value -o tsv > "$STATE/bot-principal"
}

GRAPH_APP_ID="00000003-0000-0000-c000-000000000000" # Microsoft Graph
TEAMS_CLIENT_IDS=("1fec8e78-bce4-4aaf-ab1b-5451cc387264" "5e3ce6c0-2b1f-4285-8d4b-75ee78787346") # Teams desktop/mobile, Teams web

# Teams tab single sign-on: expose an API (api://<host>/<client id>) with an access_as_user scope, and let the
# Teams clients ask for it without a consent prompt. v2 access tokens, so App Service auth accepts them.
configure_teams_sso() { # $1 = client id
  local id="$1" host; host="$(cat "$STATE/host")"
  local object; object="$(az ad app show --id "$id" --query id -o tsv)"
  local scope; scope="$(az ad app show --id "$id" --query "api.oauth2PermissionScopes[?value=='access_as_user'].id | [0]" -o tsv)"
  [ -n "$scope" ] || scope="$(python3 -c 'import uuid; print(uuid.uuid4())')"
  local url="https://graph.microsoft.com/v1.0/applications/$object"
  if ! az rest --method PATCH --url "$url" --headers "Content-Type=application/json" --body "{
      \"identifierUris\": [\"api://$host/$id\"],
      \"api\": {
        \"requestedAccessTokenVersion\": 2,
        \"oauth2PermissionScopes\": [{
          \"id\": \"$scope\", \"value\": \"access_as_user\", \"type\": \"User\", \"isEnabled\": true,
          \"adminConsentDisplayName\": \"Use Stride as you\", \"adminConsentDescription\": \"Lets Teams sign you in to Stride.\",
          \"userConsentDisplayName\": \"Use Stride as you\", \"userConsentDescription\": \"Lets Teams sign you in to Stride.\"
        }]
      }
    }" -o none; then
    echo "  ! Could not set up Teams sign-in on the app registration. Stride works in the browser; the Teams tab will not."
    return 0
  fi
  local pre=""
  for client in "${TEAMS_CLIENT_IDS[@]}"; do
    pre="$pre{\"appId\": \"$client\", \"delegatedPermissionIds\": [\"$scope\"]},"
  done
  az rest --method PATCH --url "$url" --headers "Content-Type=application/json" \
    --body "{\"api\": {\"preAuthorizedApplications\": [${pre%,}]}}" -o none \
    || echo "  ! Could not pre-authorise Teams; users may see a consent prompt in the Teams tab."
}

# Meetings (MEETINGS=graph): the app signs in to Graph as teamNN-stride using a federated credential that trusts the
# bot's managed identity (no secret), with the Calendars.ReadWrite application permission. An admin must consent.
configure_graph_access() { # $1 = client id
  local id="$1" principal; principal="$(cat "$STATE/bot-principal" 2>/dev/null || true)"
  [ -n "$principal" ] || return 0
  local tenant; tenant="$(az account show --query tenantId -o tsv)"
  if [ "$(az ad app federated-credential list --id "$id" --query "[?name=='stride-bot-identity'] | length(@)" -o tsv)" = "0" ]; then
    az ad app federated-credential create --id "$id" -o none --parameters "{
      \"name\": \"stride-bot-identity\",
      \"issuer\": \"https://login.microsoftonline.com/$tenant/v2.0\",
      \"subject\": \"$principal\",
      \"audiences\": [\"api://AzureADTokenExchange\"]
    }" || echo "  ! Could not add the federated credential; Graph meetings will fall back to links."
  fi
  if [ "$MEETINGS" = "graph" ]; then
    local role; role="$(az ad sp show --id "$GRAPH_APP_ID" --query "appRoles[?value=='Calendars.ReadWrite'].id | [0]" -o tsv)"
    az ad app permission add --id "$id" --api "$GRAPH_APP_ID" --api-permissions "$role=Role" -o none 2>/dev/null || true
    echo "  -> Ask the organisers to grant admin consent for $APP_REG_NAME (Microsoft Graph: Calendars.ReadWrite, application)."
    echo "     Until then, check-ins fall back to a pre-filled Teams meeting link."
  fi
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
  echo "1/3 Azure resources ($LOCATION, App Service $APP_SKU)..."
  local existing; existing="$(az ad app list --display-name "$APP_REG_NAME" --query "[0].appId" -o tsv)"
  deploy_bicep "$existing"
  echo "2/3 App registration $APP_REG_NAME..."
  local id; id="$(ensure_app_registration)"
  if [ "$ENABLE_TEAMS" = "true" ]; then
    configure_teams_sso "$id"
    configure_graph_access "$id"
  fi
  echo "3/3 Microsoft sign-in and Teams..."
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
  cp -r "$ROOT/backend/dist" "$ROOT/backend/assets" "$ROOT/backend/package.json" "$ROOT/backend/package-lock.json" "$pkg/"
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
