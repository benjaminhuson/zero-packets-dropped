# Hosting Stride in Azure

A PoC setup that works end to end in the team's resource group, for about £10 a month.

```
Browser / Teams tab ──HTTPS──► App Service (Linux, UK South)  app-teamNN-stride-<sfx>
                                ├─ App Service authentication: Microsoft sign-in (browser, and Teams SSO tokens)
                                └─ Node: Stride front end + API on one origin, and the bot endpoint /api/messages
                                     │ system identity                 │ id-teamNN-stride (user-assigned identity)
                                     ▼                                 ▼
                         Cosmos DB serverless             Azure Bot bot-teamNN-stride-<sfx> ──► Microsoft Teams
                                                          Graph (meetings), via a federated credential on teamNN-stride
```

## Who signs in how

| Person | Sign-in | Sees |
| --- | --- | --- |
| **New colleague**, before Entra ID | Stride account: email + password, set up with a one-time invite code from the line manager | Their own journey and the team thread |
| **New colleague**, after Entra ID | Microsoft, once the manager has linked their UPN. The Stride password stops working from the first Microsoft sign-in | The same journey, carried over |
| **Line manager** | Microsoft | Their colleagues: progress, sign-in status, the team thread. Creates accounts, links Entra, sets the buddy |
| **Buddy** | Microsoft | Colleagues they buddy: current stage and start date, and the team thread |

Access is by relationship: a manager or buddy sees only the colleagues whose record names their UPN.
Anyone in the tenant can sign in with Microsoft, but with no colleagues assigned they see an empty list.

Stride sends no email (the hackathon tenant must not email outside it), so the manager passes on the invite code.

## Deploy

You need the Azure CLI, Node 20, `zip` and `openssl`, signed in to the hackathon tenant:

```bash
az login --tenant <tenant-domain>
az account set --subscription "<subscription-name>"
cp infra/.env.example infra/.env     # then fill in TEAM_NUMBER and RESOURCE_GROUP
./infra/deploy.sh                    # infra, app registration, sign-in, then the code
```

After the first run, `./infra/deploy.sh app` redeploys the code only. The URL is printed at the end.

What `infra` does:
1. Deploys `infra/main.bicep`: App Service plan + web app (with managed identity), Cosmos DB serverless with
   key auth turned off, its containers, and a data role for the web app (and for you, to load demo data).
2. Creates or updates the `teamNN-stride` app registration (single tenant, ID tokens, no client secret).
3. Turns on App Service authentication with that app registration.

`SESSION_SECRET` and `ADMIN_TOKEN` are generated on the first run, kept as app settings, and reused on later runs.

### If something is blocked

- **`MissingSubscriptionRegistration` for `Microsoft.DocumentDB` or `Microsoft.Web`**: ask the organisers to register the provider.
- **Microsoft sign-in asks for admin approval**: the tenant may not allow users to consent. Ask the organisers to grant
  consent for `teamNN-stride` (it only asks for `openid profile email`).
- **`SubscriptionIsOverQuotaForSku` (quota 0 for B1)**: try `LOCATION=italynorth`, then `APP_SKU=F1` (free, no Always On,
  so the daily reminder job may not run), or ask the organisers for App Service quota.
- **Cosmos DB "capacity" errors in UK South**: set `LOCATION=italynorth` in `infra/.env` and run again.

## Microsoft Teams

Everything is in the hackathon tenant. `deploy.sh infra` sets it up when `ENABLE_TEAMS=true` (the default):

| Piece | What it is | Secret? |
| --- | --- | --- |
| `id-teamNN-stride` | User-assigned managed identity: the bot's identity | None |
| `bot-teamNN-stride-<sfx>` | Azure Bot (free F0, single tenant) with the Teams channel, calling `https://<app>/api/messages` | None |
| `teamNN-stride` app registration | Also exposes `api://<app host>/<client id>` with `access_as_user`, pre-authorised for the Teams clients (tab SSO) | None |
| Federated credential on `teamNN-stride` | Lets the bot identity sign in as `teamNN-stride` for Graph (meetings) | None |

**What Stride sends in Teams** (one-to-one chat with the Stride bot):
- Line manager: questions, actions and progress from the colleague, check-in requests, team thread messages.
- Buddy: team thread messages.
- New colleague: stage unlocks, check-ins and team thread messages, but only after their Entra account is linked and used.
  Before that they are not in Teams, so messages stay in Stride.

**Replying from Teams:** team thread messages and the colleague's questions arrive as cards with a reply box. Pressing
**Reply** posts the answer to the colleague's team thread as that person, with the same access rules as Stride (only the
colleague, their manager and their buddy). The card then shows "You replied: ...". Stride's thread checks for new
messages every 20 seconds, so the colleague sees the reply without refreshing.

The bot can only message people in a team that has the Stride app, or who added it themselves.

**Check-in meetings** (`MEETINGS` in `infra/.env`):
- `link` (default): the manager gets a "Schedule in Teams" button that opens a pre-filled meeting. No permissions needed.
- `graph`: Stride creates the meeting in the manager's calendar. Needs admin consent for Microsoft Graph
  `Calendars.ReadWrite` (application) on `teamNN-stride`, and an Exchange licence for the manager. If it fails, Stride falls
  back to the link. Invites go only to tenant accounts.

### Set up Teams (once)
1. Ask the organisers: (a) may we upload a custom Teams app to our own team; (b) give our 3 Microsoft 365 licences to
   `teamNN-priya`, `teamNN-ben` and `teamNN-alex`.
2. `git pull`, then `./infra/deploy.sh` (infra and app; this adds the bot).
3. In Teams, create a team **`TeamNN - Stride`** and add the three users.
4. Sign in to Stride in the browser as the manager. In **Stride in Microsoft Teams**, download the app package.
5. In Teams: your team → **⋯ → Manage team → Apps → Upload an app**, and choose the zip. Members can now get messages.
6. To open Stride as an app in Teams, each person: **Apps → Manage your apps → Upload an app → Upload a custom app**.
   Inside Teams, Stride signs them in silently.

After code changes to the Teams app (name, icons), download and upload the package again. Its version goes up automatically.

### If Teams is blocked
- **`RequestDisallowedByPolicy` for the bot** (region policy rejects `global`): ask the organisers, or set `ENABLE_TEAMS=false`
  to deploy without Teams.
- **`MissingSubscriptionRegistration` for `Microsoft.BotService` or `Microsoft.ManagedIdentity`**: ask the organisers to register it.
- **"Upload a custom app" is missing in Teams**: custom app upload is off for the tenant or the user. Ask the organisers.
- **The tab says it could not sign you in**: the `api://` setup on `teamNN-stride` failed (see the deploy output), or the
  tenant needs consent. Stride still works in the browser.
- **No messages arrive**: the person must be in a team that has the app (or have added it). Messages are skipped, not queued.
  Check the app log (`az webapp log tail ...`) for lines starting with `teams:`.

## Demo users

Create test users in Entra ID named `teamNN-<name>` (portal, or `az ad user create`). Keep passwords out of git.
Example: `teamNN-priya` (line manager), `teamNN-ben` (buddy), `teamNN-alex` (the colleague's Entra account, linked later).
They don't need Microsoft 365 licences to sign in to Stride. Only give licences (max 3) to accounts that need Teams.

**Ten fake colleagues for demos:** `./infra/seed-demo.sh` adds ten made-up new colleagues (`@example.com`) managed by
`teamNN-priya`, half with `teamNN-ben` as buddy, spread across every stage, two with the invite unused, and two with a short
team thread. The live app does the writing (via an admin-token endpoint), so it needs no database permissions and
works from Cloud Shell. It prints their sign-in passwords and invite codes in the terminal only. It is safe to run again (it skips
existing ones), sends nothing to Teams, and `--dry-run` shows what it would add. Different users? Set `DEMO_MANAGER_UPN`
and `DEMO_BUDDY_UPN` in `infra/.env`. Existing demo colleagues are listed with the manager they're linked to; `--reassign` moves them
to the manager and buddy above (for example after a mistyped username).

Demo flow:
1. Sign in as `teamNN-priya`, add a colleague (synthetic personal email, buddy `teamNN-ben@...`). Copy the invite code.
2. In a private window, choose **I have an invite code**, set a password, and start the journey.
3. Sign in as `teamNN-ben` in another window: Alex is listed with their stage. Post in the team thread.
4. As Priya, link Alex's Entra account (`teamNN-alex@...`). Alex then uses **Sign in with Microsoft** and keeps their journey.

## Deploy from GitHub Actions (optional)

`.github/workflows/deploy.yml` builds, tests and deploys the code (not the infra) when run from the Actions tab.
Set up OIDC as in `M365_AZURE_INSTRUCTIONS.md` ("Deploying from GitHub Actions"), with the federated credential's subject
matching the branch you run it from. Then add secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` and
`AZURE_RESOURCE_GROUP`, and a variable `AZURE_WEBAPP_NAME` (from `infra/.deploy/webapp` after the first deploy).

## PoC limits (deliberate)

- Secrets are App Service settings, not Key Vault: assigning Key Vault roles may need permissions the team account lacks.
- One B1 instance; the daily reminder job runs in-process (`SCHEDULER=on`, Always On).
- The front end still keeps the journey's logic in the browser and saves its state to the API. The backend's
  week-based journey routes are not yet used by the front end (ticket S-4).
- Cancara is still the rule-based responder (`AGENT=rules`).
- Teams messages are skipped, not queued, for people who have not got the app yet.
- Everything is deleted on 13 November 2026. Code is in git; Azure data is synthetic and disposable.
