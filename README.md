# Stride 🐎

**From "yes" to day one, and beyond: a guided onboarding journey for new colleagues, their line manager and their buddy.**

Built by **Team Zero Packets Dropped** for the [Launchpad](https://mwlaunchpad.com) hackathon.

---

## The problem

The weeks between accepting a job offer and the first day are where new starters feel most alone. They don't have a work
account yet, so they can't use Teams or the intranet. Their line manager juggles vetting, start dates, laptops and accounts
across different systems. And a buddy, if there is one, often meets them for the first time on day one.

## What Stride does

Stride gives everyone involved one shared journey.

| For the **new colleague** | For the **line manager** | For the **buddy** |
| --- | --- | --- |
| A step-by-step journey from offer to day one, one stage at a time | An admin panel showing every new starter and where they are | Sees the colleagues they buddy, and how far along they are |
| **Cancara**, a guide that answers questions and points to the next step | **"Needs your action"** flags (for example, confirm a start date or link a work account) | Joins the team chat from Stride or Teams |
| A **team chat** with their manager and buddy, before they have a work account | Gets messages and check-in requests **in Microsoft Teams**, and **replies from Teams** | Gets team chat messages in Teams |
| Works on a phone, with no Lloyds account needed to start | Creates the colleague's Stride account and links their work account when IT creates it | |

### The journey

Six stages, each unlocked by the one before:

| Stage | What happens | Unlocks the next stage when… |
| --- | --- | --- |
| **0. Conditional offer** | Say yes, meet Cancara | The offer is accepted |
| **1. Get set up** | Personal details, Lloyds history and values, benefits | Vetting is complete |
| **2. Meet your team** | First check-in with the manager, learning, agree a start date | Both agree the start date |
| **3. Get ready** | Notice period, choose a laptop, building-access photo | The photo is uploaded |
| **4. Settle in** | Objectives, induction, work account set up | The start date is close |
| **5. Day one** | Where to go, what to expect, first-day training | 🎉 |

## How sign-in works

New colleagues don't have a work account until they join, so Stride supports both kinds of sign-in, and moves people
from one to the other:

1. The **line manager** (signed in with Microsoft) creates the new colleague's Stride account and gets a **one-time invite code** to pass on.
2. The **new colleague** uses the code to set a password, and signs in with their personal email.
3. When IT creates their **work account** (Entra ID), the manager links it in the admin panel.
4. From the colleague's **first Microsoft sign-in**, Stride uses that account only. Their journey carries over, their old
   password stops working, and they start getting Stride messages in Teams.

Managers and buddies always sign in with Microsoft. Each person sees only the colleagues they manage or buddy.

## Microsoft Teams integration

- A **Stride bot** sends Teams messages: questions and actions to the manager, check-in requests, and team chat messages.
- Cards have a **reply box**: a manager can answer a new starter **without leaving Teams**, and the reply appears in Stride.
- **Check-ins** become a Teams meeting (through Microsoft Graph when approved, or a pre-filled "Schedule in Teams" link).
- Stride also runs **inside Teams** as an app, signing people in silently.

## How it's built

```
Browser / Teams ──► Azure App Service (UK South / Italy North)
                     ├─ Microsoft sign-in (Entra ID) for staff, and Teams single sign-on
                     ├─ React front end (stride/) + Node API (backend/) on one address
                     └─ Bot endpoint ──► Azure Bot ──► Microsoft Teams
                          │
                          ▼
                     Azure Cosmos DB (serverless)
```

| Part | Technology |
| --- | --- |
| Front end | React + TypeScript, built with Vite (`stride/`) |
| API | Node.js + TypeScript, no web framework (`backend/`) |
| Data | Azure Cosmos DB, serverless |
| Hosting | Azure App Service (Linux) |
| Sign-in | Entra ID (App Service authentication) for staff; Stride's own invite and password for new colleagues |
| Teams | Azure Bot (single tenant), Adaptive Cards, Teams SSO, Microsoft Graph for meetings |
| Infrastructure | Bicep (`infra/main.bicep`) and one deploy script (`infra/deploy.sh`) |

### Security and privacy by design

- **No secrets in code or config files.** The app reaches its database and Teams through **managed identities**, so there are no
  keys or connection strings, and database key access is switched off.
- New colleagues' passwords are hashed (scrypt), and sessions use signed, HttpOnly cookies.
- Every Teams request to the bot is checked against Microsoft's signing keys before it's acted on.
- Access is by relationship: a manager or buddy can only see, and message, their own new starters.
- **Synthetic data only.** The demo colleagues are made up and use `@example.com` addresses.

## Try it

**Live demo:** we'll show it in our presentation. Ask us for a sign-in.

**Run it on your machine** (Node 20+):

```bash
cd backend && npm install && npm run dev
```

```bash
cd stride && npm install && npm run dev
```

Open the address Vite prints. Locally, the sign-in page has a **"Dev only: act as Microsoft user"** box for trying the manager
and buddy views without Azure.

**Run the tests:**

```bash
cd backend && npm test
```

**Deploy to Azure:** see [`infra/README.md`](infra/README.md). One script creates everything, and `./infra/seed-demo.sh` adds
ten demo colleagues at different stages.

## What's next

- **Stage 6 and beyond:** the journey continues after day one (in progress).
- **Feedback:** new starters and managers give feedback at each stage. The admin panel already has a tab ready for it (in progress).
- **Cancara with AI:** answers grounded only in approved content, handing over to the manager when unsure. Never pay or individual HR cases.
- **Real events instead of demo buttons:** vetting, laptop dispatch and account creation coming from HR and IT systems.
- **Manager availability:** check-in slots from the manager's real calendar.

## The team

Ben, Tom, Izzy and Aran: journey design, front end, Cancara, Azure and Teams integration.

## Repository guide

| Folder | What's in it |
| --- | --- |
| `stride/` | The web app |
| `backend/` | The API, sign-in, Teams bot and tests ([README](backend/README.md)) |
| `infra/` | Azure infrastructure, deployment and demo data ([README](infra/README.md)) |
| `tickets/`, `ideas.md` | How we split the work and the decisions we made |
