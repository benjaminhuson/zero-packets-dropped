// Journey rules. Pure functions: no I/O, no clocks (time is passed in). Section 1 owns this file.
import { MANAGER_ACTIONS, MANAGER_NAME, PAGES, TASKS, weekOfGroup } from '../content/journey.js';
import type { Journey, TeamsMessage, UserId } from '../contracts.js';

export type MessageDraft = Pick<TeamsMessage, 'direction' | 'kind' | 'text'>;

export function newJourney(userId: UserId, firstName: string, now: Date): Journey {
  const stamp = now.toISOString();
  return {
    userId,
    firstName: firstName.trim() || 'there',
    createdAt: stamp,
    lastVisit: stamp,
    current: 0,
    completedPages: [],
    tickedTasks: [],
    consent: null,
    remindedWeeks: [],
    nudgedTasks: [],
    actionsSentUpTo: 0,
  };
}

// The furthest page a user may open: every page up to and including the first incomplete one.
export function furthestUnlocked(completedPages: string[]): number {
  const first = PAGES.findIndex((p) => !completedPages.includes(p.id));
  return first === -1 ? PAGES.length - 1 : first;
}

export function weekOfPage(index: number): number {
  return PAGES[index].week;
}

// Messages raised when the user moves into a week.
// 1. The starter's start-of-week reminder (once per week).
// 2. An overdue nudge for each manager task from an earlier week that is still open (once per task).
// 3. The action for the line manager in this week (once per week).
export function weekEntryDrafts(journey: Journey, week: number): { drafts: MessageDraft[]; next: Pick<Journey, 'remindedWeeks' | 'nudgedTasks' | 'actionsSentUpTo'> } {
  const drafts: MessageDraft[] = [];
  let remindedWeeks = journey.remindedWeeks;
  let nudgedTasks = journey.nudgedTasks;
  let actionsSentUpTo = journey.actionsSentUpTo;

  if (week > 0 && !remindedWeeks.includes(week)) {
    const labels = TASKS.filter((t) => t.group === `Week ${week}`).map((t) => t.label);
    drafts.push({
      direction: 'to-starter',
      kind: 'reminder',
      text: `Week ${week} starts now. ${labels.length ? `Tasks: ${labels.join('; ')}.` : 'No tasks this week.'}`,
    });
    remindedWeeks = [...remindedWeeks, week];
  }

  for (const task of TASKS) {
    const w = weekOfGroup(task.group);
    if (task.manager && w < week && !journey.tickedTasks.includes(task.id) && !nudgedTasks.includes(task.id)) {
      drafts.push({
        direction: 'to-starter',
        kind: 'overdue',
        text: `Still open from ${task.group}: "${task.label}". ${MANAGER_NAME.split(' ')[0]} is there to help.`,
      });
      nudgedTasks = [...nudgedTasks, task.id];
    }
  }

  const action = MANAGER_ACTIONS[week];
  if (action && week > actionsSentUpTo) {
    drafts.push({ direction: 'to-manager', kind: 'action', text: `Week ${week} action for ${MANAGER_NAME.split(' ')[0]}: ${action}` });
    actionsSentUpTo = week;
  }

  return { drafts, next: { remindedWeeks, nudgedTasks, actionsSentUpTo } };
}

// Complete the page the user is on and move to the next one.
// Returns the updated journey and any Teams messages the change should raise.
export function completeCurrentPage(journey: Journey, now: Date): { journey: Journey; drafts: MessageDraft[] } {
  const pageId = PAGES[journey.current].id;
  const completedPages = journey.completedPages.includes(pageId)
    ? journey.completedPages
    : [...journey.completedPages, pageId];
  const nextIndex = Math.min(journey.current + 1, PAGES.length - 1);
  const enteringWeek = PAGES[nextIndex].week !== PAGES[journey.current].week;
  const base: Journey = { ...journey, completedPages, current: nextIndex, lastVisit: now.toISOString() };
  if (!enteringWeek) return { journey: base, drafts: [] };
  const entry = weekEntryDrafts(base, PAGES[nextIndex].week);
  return { journey: { ...base, ...entry.next }, drafts: entry.drafts };
}

export function toggleTask(journey: Journey, taskId: string): Journey {
  const ticked = journey.tickedTasks.includes(taskId)
    ? journey.tickedTasks.filter((t) => t !== taskId)
    : [...journey.tickedTasks, taskId];
  return { ...journey, tickedTasks: ticked };
}

// Actions for the manager covering every week up to and including `throughWeek` not yet sent.
export function pendingManagerActions(journey: Journey, throughWeek: number): string[] {
  const out: string[] = [];
  for (let w = journey.actionsSentUpTo + 1; w <= throughWeek; w++) {
    if (MANAGER_ACTIONS[w]) out.push(`Week ${w}: ${MANAGER_ACTIONS[w]}`);
  }
  return out;
}

