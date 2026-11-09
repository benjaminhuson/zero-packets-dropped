# Group A: stages 0, 1 and 2

Offer, set-up, and meet the team. Start with the shared tickets S-1 to S-3, then work your own tickets.

---

### A-1: Stage 0, offer acceptance and account creation
- **Stage:** 0. **Depends on:** S-1.
- **Trigger:** the new starter accepts the job (unlocks stage 1).
- **Do:** make the four stage 0 steps show their real state:
  1. "You said yes to the job" — shows the accepted date.
  2. "Stride account created" — automatic, done when accepted.
  3. "Login sent to your email" — shows the address it was sent to, masked (for example `a***@example.com`).
  4. "Line manager and buddy contacted" — shows the manager and buddy names.
- **Acceptance:** each step shows its state after accepting; no real email addresses appear.
- **Files:** `stride/src/stages/stage0.ts`, `stride/src/components/StageJourney.tsx`.

### A-2: Stage 1, personal details form
- **Stage:** 1. **Depends on:** S-3.
- **Do:** validate the details form: mobile number format (UK), personal email format, and preferred name length. Show inline errors. Show "Linked from Workday" next to any field that Workday fills in.
- **Acceptance:** the form blocks invalid input and shows errors; saving marks the step done.
- **Files:** `stride/src/components/steps/Details.tsx` (or the current `StepRow`).

### A-3: Stage 1, intro content (history, strategy, benefits, permissions)
- **Stage:** 1. **Depends on:** S-1.
- **Do:** replace the placeholder text for "Our history", "Our strategy", "Your benefits" and "Your permissions" with approved content. Each step opens a short page (not just a tick box) and is marked done when the page is read to the end.
- **Acceptance:** each page has approved copy; "done" needs the page to be opened.
- **Blocked on:** approved copy from the Lloyds team.

### A-4: Stage 1, values explorer is the values step
- **Stage:** 1. **Depends on:** nothing.
- **Do:** check that the values explorer marks the "Our values" step done only after all five are viewed (it already does). Confirm the copy matches the values poster.
- **Acceptance:** tick happens only after all five values are viewed; text matches the poster.

### A-5: Stage 1, vetting trigger
- **Stage:** 1. **Depends on:** S-2, S-6.
- **Trigger:** Workday vetting complete unlocks stage 2.
- **Do:** show a "Vetting in progress" state with a plain-language explanation, and a notification when it completes. Notify only once (use the `announced` list).
- **Acceptance:** exactly one stage 2 notification, even if the event arrives twice.

### A-6: Stage 2, one-click meeting from the manager's side
- **Stage:** 2. **Depends on:** S-1, S-6.
- **Do:** the starter's check-in request appears in the manager's Teams feed as an action with two buttons: "Accept" and "Suggest another time". Accepting marks the check-in as booked.
- **Acceptance:** the manager sees the request; accepting updates the starter's step.
- **Files:** `stride/src/store.ts` (or the events adapter), `stride/src/components/TeamsPanel.tsx`.

### A-7: Stage 2, job family learning links
- **Stage:** 2. **Depends on:** S-1.
- **Do:** replace the placeholder link with a list of Engineering job family learning links from Workday (static for the PoC). Show each link's title and type (course, article, video).
- **Acceptance:** at least three real, approved links; each opens in a new tab.
- **Blocked on:** approved links from the Lloyds team.

### A-8: Stage 2, start date agreement
- **Stage:** 2. **Depends on:** S-2.
- **Trigger:** both the starter and the manager agree the start date (unlocks stage 3).
- **Do:** add a "change date" option that resets the manager's confirmation. Block dates in the past and weekends.
- **Acceptance:** changing the date needs the manager to confirm again; past dates and weekends are rejected.
