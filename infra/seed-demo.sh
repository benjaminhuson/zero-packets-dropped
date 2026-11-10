#!/usr/bin/env bash
# Adds 10 fake new colleagues to Stride for demos (synthetic data only), managed by teamNN-priya, some with
# teamNN-ben as buddy. Safe to run again: existing ones are skipped. Nothing is sent to Teams.
#
#   ./infra/seed-demo.sh            add them
#   ./infra/seed-demo.sh --dry-run  show what would be added, save nothing
#
# Prints sign-in details for the fake colleagues in this terminal only. Don't paste them anywhere public.
# Different users? Set DEMO_MANAGER_UPN and DEMO_BUDDY_UPN in infra/.env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$ROOT/infra/.env" ] || { echo "Create infra/.env from infra/.env.example first."; exit 1; }
set -a; source "$ROOT/infra/.env"; set +a
: "${TEAM_NUMBER:?set TEAM_NUMBER in infra/.env}" "${RESOURCE_GROUP:?set RESOURCE_GROUP in infra/.env}"

az account show -o none 2>/dev/null || { echo "Run az login --tenant <tenant-domain> first."; exit 1; }

# The test users share the signed-in account's domain unless told otherwise.
domain="$(az ad signed-in-user show --query userPrincipalName -o tsv | cut -d@ -f2)"
manager="${DEMO_MANAGER_UPN:-team${TEAM_NUMBER}-priya@${domain}}"
buddy="${DEMO_BUDDY_UPN:-team${TEAM_NUMBER}-ben@${domain}}"

endpoint="$(az deployment group show -g "$RESOURCE_GROUP" -n stride --query properties.outputs.cosmosEndpoint.value -o tsv)"
[ -n "$endpoint" ] || { echo "No Stride deployment found. Run ./infra/deploy.sh first."; exit 1; }

echo "Building the backend..."
(cd "$ROOT/backend" && npm ci --no-audit --no-fund --silent && npm run build --silent)

echo "Adding demo colleagues..."
AZURE_COSMOS_ENDPOINT="$endpoint" AZURE_COSMOS_DATABASE=stride \
  node "$ROOT/backend/dist/scripts/seed-demo.js" --manager "$manager" --buddy "$buddy" "$@"
