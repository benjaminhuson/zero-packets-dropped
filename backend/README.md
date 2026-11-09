# Stride backend (skeleton)

Local skeleton for the Stride API. It runs with in-memory storage, a Teams mock and a rule-based Cancara,
so the team can work in parallel before any Azure resources exist.

Nothing here is deployed. The Azure wiring (Cosmos DB, Graph, Entra ID, Functions) is the next step, and each
stub says what it needs.

## Run it

```bash
cd backend
npm install
npm test          # 9 tests: domain rules, consent gate, nudges, catch-up, Cancara escalation
npm run dev       # starts on http://localhost:3001 (PORT in .env)
```

Dev auth: send an `x-user-id` header with any string. This is a placeholder until Entra ID is wired in (section 5).

Quick check:

```bash
curl -s localhost:3001/api/health
curl -s -X POST localhost:3001/api/journey -H 'content-type: application/json' -H 'x-user-id: demo' -d '{"firstName":"Alex"}'
```

## Layout

```
src/
  contracts.ts          SHARED types and gateway interfaces. Read this first.
  content/journey.ts    pages, checklist tasks, manager actions (mirrors stride/src/data.ts)
  domain/journey.ts     pure rules: week entry, reminders, nudges, page completion
  api/service.ts        use cases: combines domain + store + gateways. Consent gate lives here.
  api/routes.ts         HTTP routes (thin)
  api/ids.ts            checklist ids for the front end
  store/memory.ts       in-memory store (local runs and tests)
  store/cosmos.ts       Cosmos DB store (stub)
  teams/mock.ts         Teams mock (local)
  teams/graph.ts        Microsoft Graph / Teams bot (stub)
  agent/rules.ts        Cancara rule-based responder (local)
  agent/ai.ts           AI-backed Cancara (stub)
  scheduler/reminders.ts  daily catch-up job (idempotent)
  config.ts, server.ts  settings and entry point
test/journey.test.ts    behaviour tests
```

## The five sections

Each section owns a folder or file set and codes against `src/contracts.ts`. Change a contract only through section 1, and tell the others.

| # | Section | Owns | Done when |
|---|---------|------|-----------|
| 1 | **API and domain** | `api/`, `domain/`, `content/`, `contracts.ts`, `server.ts` | Routes and rules match the front end; tests pass. Also: move `content/` to one shared package used by the front end. |
| 2 | **Data (Cosmos DB)** | `store/cosmos.ts`, `store/memory.ts` | Every `Store` method works against a local Cosmos emulator or a dev account in our resource group; same tests pass with `STORE=cosmos`. |
| 3 | **Teams and Graph** | `teams/graph.ts`, a Teams app manifest, bot setup | Reminders and manager messages arrive in a test Teams chat; check-in creates a meeting. Needs the permission request below. |
| 4 | **Cancara (AI)** | `agent/ai.ts`, prompt and grounding rules | `AGENT=ai` answers only from approved content, escalates when unsure, and never answers pay or individual HR cases. |
| 5 | **Identity, scheduler and deployment** | auth middleware, timer trigger, Azure setup, `.env.example` | Entra ID tokens replace `x-user-id`; the catch-up job runs on a daily timer; the app deploys to our resource group in UK South or Italy North. |

## Before we start section 3

Ask the organisers for these now. Admin consent can take time, and it is the most likely blocker for a live demo:
- A Teams app installed in our test team (not the org-wide catalogue).
- Microsoft Graph application permissions for chat messages and online meetings, with admin consent.

## Team rules (from `CLAUDE.md`)

- Create Azure resources only in our resource group, named `<type>-teamNN-<purpose>`. Team number still to confirm.
- Deploy only to UK South or Italy North.
- Synthetic data only. No real personal data.
- Keep real values out of git: use `.env` (ignored) and `.env.example` (placeholders only).
- The organisers delete all resource groups on **13 November 2026**. Anything built in Azure is lost then, so keep a handover note.

## Known gaps (deliberate for the skeleton)

- In-memory data: a restart loses everything.
- `x-user-id` is not authentication. Do not expose this server beyond local development.
- Manager access control is not enforced. Any caller who knows a user id can read the summary. Section 5 must add a manager role check.
- Content is duplicated from the front end until section 1 extracts it.
