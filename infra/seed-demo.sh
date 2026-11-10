#!/usr/bin/env bash
# Adds 10 fake new colleagues to Stride for demos (synthetic data only), managed by teamNN-priya, some with
# teamNN-ben as buddy. Safe to run again: existing ones are skipped. Nothing is sent to Teams.
#
#   ./infra/seed-demo.sh            add them
#   ./infra/seed-demo.sh --dry-run  show what would be added, save nothing
#
# The live app does the writing (it already has database access), so this needs no database permissions: it calls
# POST /api/admin/seed-demo with the app's admin token. Needs the app deployed with that endpoint (deploy.sh app).
# Prints sign-in details for the fake colleagues in this terminal only. Don't paste them anywhere public.
# Different users? Set DEMO_MANAGER_UPN and DEMO_BUDDY_UPN in infra/.env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$ROOT/infra/.env" ] || { echo "Create infra/.env from infra/.env.example first."; exit 1; }
set -a; source "$ROOT/infra/.env"; set +a
: "${TEAM_NUMBER:?set TEAM_NUMBER in infra/.env}" "${RESOURCE_GROUP:?set RESOURCE_GROUP in infra/.env}"
DRY_RUN=false; [ "${1:-}" = "--dry-run" ] && DRY_RUN=true

az account show -o none 2>/dev/null || { echo "Run az login --tenant <tenant-domain> first."; exit 1; }

# The test users share the signed-in account's domain unless told otherwise.
domain="$(az ad signed-in-user show --query userPrincipalName -o tsv | cut -d@ -f2)"
manager="${DEMO_MANAGER_UPN:-team${TEAM_NUMBER}-priya@${domain}}"
buddy="${DEMO_BUDDY_UPN:-team${TEAM_NUMBER}-ben@${domain}}"

app="$(az deployment group show -g "$RESOURCE_GROUP" -n stride --query properties.outputs.webAppName.value -o tsv 2>/dev/null || true)"
host="$(az deployment group show -g "$RESOURCE_GROUP" -n stride --query properties.outputs.hostName.value -o tsv 2>/dev/null || true)"
[ -n "$app" ] && [ -n "$host" ] || { echo "No Stride deployment found. Run ./infra/deploy.sh first."; exit 1; }

# The admin token goes to curl through a private temp file, never on the command line or the screen.
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
chmod 700 "$tmp"
token="$(az webapp config appsettings list -g "$RESOURCE_GROUP" -n "$app" --query "[?name=='ADMIN_TOKEN'].value | [0]" -o tsv)"
[ -n "$token" ] || { echo "The app has no ADMIN_TOKEN setting. Run ./infra/deploy.sh infra."; exit 1; }
printf 'x-admin-token: %s\n' "$token" > "$tmp/headers"
printf '{"managerUpn":"%s","buddyUpn":"%s","dryRun":%s}' "$manager" "$buddy" "$DRY_RUN" > "$tmp/body"

echo "Asking Stride to add the demo colleagues..."
status="$(curl -sS -o "$tmp/out" -w '%{http_code}' -X POST "${STRIDE_URL:-https://${host}}/api/admin/seed-demo" \
  -H @"$tmp/headers" -H 'content-type: application/json' --data-binary @"$tmp/body" --max-time 120)"
if [ "$status" = "404" ]; then
  echo "The app doesn't have the demo seed yet. Run ./infra/deploy.sh app first, then try again."; exit 1
elif [ "$status" != "200" ]; then
  echo "Stride said $status: $(cat "$tmp/out")"; exit 1
fi

python3 - "$tmp/out" "$manager" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
rows = data["rows"]
cols = [("name", "Name"), ("email", "Email (Stride sign-in)"), ("stage", "Stage"), ("buddy", "Buddy")]
w = {k: max(len(h), *(len(str(r[k])) for r in rows)) for k, h in cols}
if data["dryRun"]:
    print("\nDRY RUN: nothing was saved.")
print()
print("  ".join(h.ljust(w[k]) for k, h in cols))
for r in rows:
    secret = f"password {r['password']}" if r["password"] else f"invite code {r['inviteCode']}" if r["inviteCode"] else ""
    print("  ".join(str(r[k]).ljust(w[k]) for k, _ in cols) + "  " + secret)
added = sum(1 for r in rows if not r["skipped"])
print(f"\n{added} added, {len(rows) - added} already there. Line manager: {sys.argv[2]}")
print("Keep these passwords and codes to yourself: they are only shown here, once.")
PY
