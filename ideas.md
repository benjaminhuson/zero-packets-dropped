# Stride ideas (backlog)

Ideas raised for Stride. Status is noted on each item.

## Engagement
1. **Cancara messages:** short daily tips and nudges from the horse. **Decided:** keep as a Cancara feature, delivered through the Teams reminders (5).
2. **Cohort board:** leaderboard of new starters in the same intake, opt-in names. **Decided:** dropped.
3. **Quick quizzes:** short questions on Lloyds and the values after each checkpoint. **Decided:** Lloyds L&D writes the content; placeholder until then. No XP.
4. **Manager view:** line manager sees progress and can send a cheer or a nudge. **Decided:** build first.
5. **Real reminders:** Teams messages when a week's tasks are due or a check-in is overdue. **Decided:** build first.
6. **Rewards:** perks or prizes at set milestones (needs Lloyds approval). **Decided:** parked until Lloyds approves.
7. **Sound and celebration:** starting-gate sound, confetti at Day 90. **Decided:** dropped.

## Already built (for reference)
- Week-by-week timeline (offer day, weeks 1-13) with the horse marker.
- Cancara chat: rule-based answers, pass questions to the line manager on Teams, notify the manager of their actions.
- Teams panel: share progress, request a check-in (mocked locally).
- Interactive values explorer built from the poster icons.

## Decisions: round 2 (reminders and manager view)
- **Reminders (5):** weekly message at the start of each week listing that week's tasks; plus a nudge when a check-in is overdue. No day-before pings.
- **Manager view (4):** shows the current week, tasks done, and check-in requests. Reflections stay private.
- **Consent:** progress sharing is always on (user decision). Flag: needs an HR/legal check before any real use, as this shares an employee's progress with their manager.
- **Teams messages to the manager (Q8):** no fixed cap. Messages are event-driven: relevant workday notifications when the manager needs to act, and the new starter can request help from their manager through Cancara.


## Build status (round 2 items)
- **Reminders (5):** built. Weekly reminder to the starter on entering each week, plus an overdue nudge for unticked manager tasks. Mocked delivery (stored in the browser).
- **Manager view (4):** built as a preview in the Teams panel: current week, tasks done, check-in requests. Reflections not shown.
- **Known gaps:** reminders fire when a page is completed into a new week, not when a week is opened by clicking the timeline. Consent wording on the entry screen is not yet added (progress sharing is always on, per decision).
