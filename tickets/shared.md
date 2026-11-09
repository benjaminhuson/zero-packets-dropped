# Shared tickets

Do these first, or agree the interface with the other group before starting. They stop the two groups editing the same lines.

---

### S-1: Split stage content into one file per stage
- **Depends on:** nothing. Do first.
- **Why:** both groups edit `stride/src/stages.ts`, which causes merge conflicts.
- **Do:** move each stage into `stride/src/stages/stage0.ts` … `stage5.ts`, with `stages/index.ts` re-exporting `STAGES`, `APPROACHING_DAYS` and `JOB_FAMILY`. No behaviour change.
- **Acceptance:** `npm run build` passes; the stage screen looks and behaves exactly as before; the Group A and Group B folders are separate files.
- **Files:** `stride/src/stages.ts` (remove), `stride/src/stages/*` (new).

### S-2: Move trigger logic out of the store
- **Depends on:** nothing.
- **Why:** `triggerMet` and `unlockedStage` in `store.ts` are needed by both groups.
- **Do:** move these into `stride/src/triggers.ts`, with unit-style checks in the browser console or a test file.
- **Acceptance:** each trigger behaves exactly as now (the rules are in `stride/src/store.ts`: stage 0 accepted, stage 1 vetting, stage 2 both agreed a date, stage 3 photo uploaded, stage 4 start date approaching); no behaviour change.
- **Files:** `stride/src/store.ts`, `stride/src/triggers.ts` (new).

### S-3: Step renderer per kind
- **Depends on:** nothing.
- **Why:** `StepRow` in `StageJourney.tsx` is one long switch, and both groups add step kinds.
- **Do:** move each step kind into its own component under `stride/src/components/steps/`, with a registry keyed by `StepKind`.
- **Acceptance:** all existing step kinds render and save as before.
- **Files:** `stride/src/components/StageJourney.tsx`, `stride/src/components/steps/*` (new).

### S-4: Backend stage model (section 1 of the backend README)
- **Depends on:** the stage trigger rules being agreed (see group tickets).
- **Why:** the backend skeleton still uses the old weekly model.
- **Do:** add the stage model to `backend/src/contracts.ts`, and a stage-trigger rule in `backend/src/domain/`. Keep the same tests passing and add tests for each trigger.
- **Acceptance:** `npm test` in `backend/` passes; the API returns the current stage for a user.
- **Files:** `backend/src/contracts.ts`, `backend/src/domain/*`, `backend/test/*`.

### S-5: Decide the approaching-date rule
- **Depends on:** nothing. Needs a decision from the Lloyds team.
- **Question:** how many days before the start date does stage 5 open? The PoC uses 7.
- **Acceptance:** a written decision in this ticket, and `APPROACHING_DAYS` updated if it changes.

### S-6: Replace the prototype controls with an event adapter
- **Depends on:** S-2.
- **Why:** the demo buttons stand in for Workday, Entra and IT events.
- **Do:** create `stride/src/events.ts`, which every control calls. Each event has a name, a payload and a source (Workday, Entra, IT, manager).
- **Acceptance:** the demo panel calls only `events.ts`; swapping in real events later changes one file.
- **Files:** `stride/src/events.ts` (new), `stride/src/components/StageJourney.tsx`.
