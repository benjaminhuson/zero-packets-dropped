# Stride PoC tickets

Engineering job family PoC, stages 0 to 5. Tickets are markdown so they can be reviewed and worked on without changing code until someone picks one up.

## Two groups, working in parallel

| Group | Stages | Ticket file |
|-------|--------|-------------|
| **Group A** | 0, 1 and 2: offer, set-up, meet the team | [group-a.md](group-a.md) |
| **Group B** | 3, 4 and 5: get ready, settle in, day one | [group-b.md](group-b.md) |
| **Shared** | Both groups, and the backend | [shared.md](shared.md) |

Shared tickets come first. They split up the stage file so the two groups do not collide.

## Conventions

- Ticket IDs: `A-…` for Group A, `B-…` for Group B, `S-…` for shared.
- Each ticket lists what it depends on, and which files it is likely to touch.
- "Done" means the acceptance criteria pass in the browser, and the build passes (`npm run build` in `stride/`).
- Placeholder copy must be approved by the Lloyds team before it goes live.
- Do not put real personal data, real Workday, Entra or Stripe values, or secrets in tickets or code.

## Team rules that apply

- Azure resources only in our resource group, named `<type>-teamNN-<purpose>`, in UK South or Italy North.
- Synthetic data only.
- Resource groups are deleted on 13 November 2026.
