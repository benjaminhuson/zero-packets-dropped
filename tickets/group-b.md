# Group B: stages 3, 4 and 5

Get ready, settle in, and day one. Start with the shared tickets S-1 to S-3, then work your own tickets.

---

### B-1: Stage 3, working notice
- **Stage:** 3. **Depends on:** S-3.
- **Do:** replace the single tick box with two questions: "Are you currently working notice?" (yes/no) and, if yes, "Expected last day" (date). Store both.
- **Acceptance:** answers are stored; a last-day date in the past is rejected.

### B-2: Stage 3, device choice
- **Stage:** 3. **Depends on:** S-3.
- **Do:** after choosing Mac or Windows, show what happens next (for example, delivery to the same address as the laptop). Allow a change until the laptop is dispatched.
- **Acceptance:** the choice can be changed until stage 4's laptop step is done; the next-step text matches the choice.

### B-3: Stage 3, building access photo
- **Stage:** 3. **Depends on:** S-2.
- **Trigger:** photo uploaded unlocks stage 4.
- **Do:** check the file is an image and under 5 MB, show a preview, and explain how it will be used. Do not store the photo in the browser beyond the session.
- **Acceptance:** non-image and oversized files are rejected; a preview is shown; the trigger still works.
- **Note:** a building access photo is personal data. It needs a data-protection decision from the Lloyds team before real use.

### B-4: Stage 4, team check-in and admin check-up
- **Stage:** 4. **Depends on:** S-3.
- **Do:** "Meet the immediate team" needs a booked check-in with the manager (use the existing check-in request). "Admin check-up" becomes a checklist of every earlier stage step, with any incomplete item linked to its stage.
- **Acceptance:** the admin check-up lists incomplete items with a link to each; the step is done when all are complete.

### B-5: Stage 4, objectives
- **Stage:** 4. **Depends on:** S-3.
- **Do:** guide the starter with three prompts: the goal, how it is measured (KPI), and by when. Save all three. Show the manager a summary once saved.
- **Acceptance:** the step is done only when all three prompts have an answer.

### B-6: Stage 4, Entra UPN from the manager
- **Stage:** 4. **Depends on:** S-6.
- **Do:** the manager enters the UPN in their Teams feed (an action with a text box), not in the starter's view. Validate the format (`name@domain`). Show "Account set up" to the starter once saved.
- **Acceptance:** the starter cannot enter the UPN; the manager can; the format is validated.
- **Note:** UPNs are personal data. Use synthetic values in the demo.

### B-7: Stage 4, laptop and welcome pack
- **Stage:** 4. **Depends on:** S-6.
- **Do:** show tracking for the laptop: "Ordered", "Dispatched", "Delivered". The events come from IT (use the event adapter). Show the welcome pack as a separate line.
- **Acceptance:** the three states show in order; each change sends one Teams message to the starter.

### B-8: Stage 4, knowledge base and induction
- **Stage:** 4. **Depends on:** S-3.
- **Do:** list the knowledge base articles (ServiceNow, static for the PoC) with a "read" tick. Booking the induction shows the next available dates.
- **Acceptance:** at least three articles; the induction step shows dates and a booking confirmation.
- **Blocked on:** approved article list from the Lloyds team.

### B-9: Stage 5, start date and countdown
- **Stage:** 5. **Depends on:** S-2.
- **Do:** show the agreed start date, a countdown in days, and what to bring on the day. The "started" state is reached on the start date (or the demo control).
- **Acceptance:** the countdown is correct; the started state shows a welcome message.

### B-10: Stage 5, mandatory training from Workday
- **Stage:** 5. **Depends on:** S-1.
- **Do:** list the statutory and mandatory training items from Workday (static for the PoC). Each item has a due date and a status.
- **Acceptance:** at least four items, each with a due date and status.
- **Blocked on:** the list of mandatory training from the Lloyds team.

### B-11: Stage 5, emergency contacts
- **Stage:** 5. **Depends on:** S-3.
- **Do:** replace the free-text box with structured fields: name, relationship, phone. Validate the phone format. Store one or more contacts.
- **Acceptance:** at least one contact is required; the phone format is validated.
- **Note:** emergency contacts are personal data. Do not use real contacts in the demo.
