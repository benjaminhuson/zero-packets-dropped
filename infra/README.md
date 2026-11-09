# Hosting Stride in Azure

A PoC setup that works end to end in the team's resource group, for about £10 a month.

```
Browser ──HTTPS──► App Service (Linux B1, UK South)  app-teamNN-stride-<sfx>
                    ├─ App Service authentication: Microsoft sign-in (managers, buddies, linked colleagues)
                    └─ Node: Stride front end (stride/dist) + API (backend/) on one origin
                         │  managed identity, no keys
                         ▼
                   Cosmos DB serverless  cosmos-teamNN-stride-<sfx>   database "stride"
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
- **Cosmos DB "capacity" errors in UK South**: set `LOCATION=italynorth` in `infra/.env` and run again.

## Demo users

Create test users in Entra ID named `teamNN-<name>` (portal, or `az ad user create`). Keep passwords out of git.
Example: `teamNN-priya` (line manager), `teamNN-ben` (buddy), `teamNN-alex` (the colleague's Entra account, linked later).
They don't need Microsoft 365 licences to sign in to Stride. Only give licences (max 3) to accounts that need Teams.

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
- Teams delivery and Cancara AI are still the local mock and rule-based responder (`TEAMS=mock`, `AGENT=rules`).
- Everything is deleted on 13 November 2026. Code is in git; Azure data is synthetic and disposable.
