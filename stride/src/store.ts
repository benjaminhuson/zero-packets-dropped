import { useEffect, useState } from 'react';
import { CHECKLIST, LINE_MANAGER, PAGES } from './data';
import { answer, managerActionFor, nextManagerActions, type ChatMessage } from './agent';

const STORAGE_KEY = 'stride-journey-v2';
const MANAGER_FIRST_NAME = LINE_MANAGER.name.split(' ')[0];

export type CheckInRequest = {
  id: string;
  week: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  topic: string;
  status: 'sent';
};

export type ProgressShare = {
  id: string;
  sentAt: string; // ISO timestamp
  week: number;
  pageTitle: string;
};

// A Teams message. 'to-manager' goes to the line manager; 'to-starter' comes from Cancara to the new starter.
export type TeamsMessage = {
  id: string;
  sentAt: string;
  direction: 'to-manager' | 'to-starter';
  kind: 'question' | 'action' | 'progress' | 'check-in' | 'reminder' | 'overdue';
  text: string;
};

export type JourneyState = {
  registered: boolean;
  firstName: string;
  // Index into PAGES of the page being viewed
  current: number;
  // Page ids that have been completed
  completed: string[];
  // Checklist task ids that have been ticked off
  ticked: string[];
  // Teams activity (prototype: stored locally, not sent anywhere)
  shares: ProgressShare[];
  checkIns: CheckInRequest[];
  teams: TeamsMessage[];
  // Cancara chat history
  chat: ChatMessage[];
  // Last time the user opened Stride (ISO timestamp)
  lastVisit: string;
  // Highest week the manager has been told about actions for
  actionsSentUpTo: number;
  // Weeks whose start-of-week reminder has been sent
  remindedWeeks: number[];
  // Manager tasks already nudged as overdue
  nudged: string[];
};

const initial: JourneyState = {
  registered: false,
  firstName: '',
  current: 0,
  completed: [],
  ticked: [],
  shares: [],
  checkIns: [],
  teams: [],
  chat: [],
  lastVisit: '',
  actionsSentUpTo: 0,
  remindedWeeks: [],
  nudged: [],
};

function load(): JourneyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    return { ...initial, ...(JSON.parse(raw) as Partial<JourneyState>) };
  } catch {
    return initial;
  }
}

// The furthest page the user can reach: every page up to and including the first incomplete one.
export function furthestUnlocked(completed: string[]): number {
  const firstIncomplete = PAGES.findIndex((p) => !completed.includes(p.id));
  return firstIncomplete === -1 ? PAGES.length - 1 : firstIncomplete;
}

const DAY_MS = 86400000;
const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// 'Week 5' -> 5, 'Offer day' -> 0
const weekOfGroup = (group: string) => (group.startsWith('Week ') ? parseInt(group.slice(5), 10) : 0);

// Messages raised when the user moves into a new week: the starter's weekly reminder,
// overdue manager tasks from earlier weeks, and the action for the line manager this week.
function weekEntryMessages(s: JourneyState, week: number): { teams: TeamsMessage[]; remindedWeeks: number[]; nudged: string[]; actionsSentUpTo: number } {
  const teams: TeamsMessage[] = [];
  let remindedWeeks = s.remindedWeeks;
  let nudged = s.nudged;
  let actionsSentUpTo = s.actionsSentUpTo;
  const sentAt = now();

  if (week > 0 && !remindedWeeks.includes(week)) {
    const labels = CHECKLIST.filter((c) => c.group === `Week ${week}`).map((c) => c.label);
    teams.push({
      id: newId('teams'),
      sentAt,
      direction: 'to-starter',
      kind: 'reminder',
      text: `Week ${week} starts now. ${labels.length ? `Tasks: ${labels.join('; ')}.` : 'No tasks this week.'}`,
    });
    remindedWeeks = [...remindedWeeks, week];
  }

  for (const t of CHECKLIST) {
    const w = weekOfGroup(t.group);
    if (t.manager && w < week && !s.ticked.includes(t.id) && !nudged.includes(t.id)) {
      teams.push({
        id: newId('teams'),
        sentAt,
        direction: 'to-starter',
        kind: 'overdue',
        text: `Still open from ${t.group}: "${t.label}". ${MANAGER_FIRST_NAME} is there to help. Ask Cancara to request a time.`,
      });
      nudged = [...nudged, t.id];
    }
  }

  const action = managerActionFor(week);
  if (action && week > actionsSentUpTo) {
    teams.push({
      id: newId('teams'),
      sentAt,
      direction: 'to-manager',
      kind: 'action',
      text: `Week ${week} action for ${MANAGER_FIRST_NAME}: ${action}`,
    });
    actionsSentUpTo = week;
  }

  return { teams, remindedWeeks, nudged, actionsSentUpTo };
}

export function useJourney() {
  // Read the saved state once so we can say how long it has been since the last visit
  const [boot] = useState(() => {
    const saved = load();
    const daysAway =
      saved.registered && saved.lastVisit
        ? Math.floor((Date.now() - new Date(saved.lastVisit).getTime()) / DAY_MS)
        : 0;
    return { state: { ...saved, lastVisit: now() }, daysAway };
  });
  const [state, setState] = useState<JourneyState>(boot.state);
  const daysAway = boot.daysAway;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const register = (firstName: string) =>
    setState((s) => ({ ...s, registered: true, firstName: firstName.trim() || 'there' }));

  const goTo = (index: number) =>
    setState((s) => ({ ...s, current: Math.max(0, Math.min(index, furthestUnlocked(s.completed))) }));

  const completePage = () =>
    setState((s) => {
      const id = PAGES[s.current].id;
      const completed = s.completed.includes(id) ? s.completed : [...s.completed, id];
      const nextIndex = Math.min(s.current + 1, PAGES.length - 1);
      const nextWeek = PAGES[nextIndex].week;
      const entering = nextWeek !== PAGES[s.current].week;
      if (!entering) return { ...s, completed, current: nextIndex };
      const entry = weekEntryMessages({ ...s, completed }, nextWeek);
      return {
        ...s,
        completed,
        current: nextIndex,
        teams: [...entry.teams, ...s.teams],
        remindedWeeks: entry.remindedWeeks,
        nudged: entry.nudged,
        actionsSentUpTo: entry.actionsSentUpTo,
      };
    });

  const toggleTask = (taskId: string) =>
    setState((s) => ({
      ...s,
      ticked: s.ticked.includes(taskId) ? s.ticked.filter((t) => t !== taskId) : [...s.ticked, taskId],
    }));

  const shareProgress = () =>
    setState((s) => {
      const page = PAGES[s.current];
      const share: ProgressShare = { id: newId('share'), sentAt: now(), week: page.week, pageTitle: page.title };
      const msg: TeamsMessage = {
        id: newId('teams'),
        sentAt: now(),
        direction: 'to-manager',
        kind: 'progress',
        text: `${s.firstName || 'The new starter'} is on ${page.week === 0 ? 'Offer day' : `Week ${page.week}`}: ${page.title}.`,
      };
      return { ...s, shares: [share, ...s.shares], teams: [msg, ...s.teams] };
    });

  const requestCheckIn = (req: { date: string; time: string; topic: string }) =>
    setState((s) => {
      const checkIn: CheckInRequest = { id: newId('checkin'), week: PAGES[s.current].week, status: 'sent', ...req };
      const msg: TeamsMessage = {
        id: newId('teams'),
        sentAt: now(),
        direction: 'to-manager',
        kind: 'check-in',
        text: `Check-in request for ${req.date} at ${req.time}: ${req.topic}`,
      };
      return { ...s, checkIns: [checkIn, ...s.checkIns], teams: [msg, ...s.teams] };
    });

  // Ask Cancara a question: the user's message and Cancara's reply are added to the chat.
  // If Cancara cannot answer from Stride content, it offers to pass the question to the line manager.
  const askCancara = (question: string) =>
    setState((s) => {
      const page = PAGES[s.current];
      const reply = answer(question, page.week, page.title);
      const you: ChatMessage = { id: newId('msg'), from: 'you', text: question, sentAt: now() };
      const cancara: ChatMessage = {
        id: newId('msg'),
        from: 'cancara',
        text: reply.text,
        sentAt: now(),
        escalate: reply.escalate,
      };
      return { ...s, chat: [...s.chat, you, cancara] };
    });

  // Pass a question on to the line manager in Teams
  const sendQuestionToManager = (question: string) =>
    setState((s) => {
      const msg: TeamsMessage = { id: newId('teams'), sentAt: now(), direction: 'to-manager', kind: 'question', text: question };
      const reply: ChatMessage = {
        id: newId('msg'),
        from: 'cancara',
        text: `Sent to ${MANAGER_FIRST_NAME} on Teams. I will let you know when ${MANAGER_FIRST_NAME === 'Priya' ? 'she' : 'they'} reply.`,
        sentAt: now(),
      };
      // The escalation has now been handled, so stop offering it
      const chat = s.chat.map((m) => (m.escalate ? { ...m, escalate: false } : m));
      return { ...s, teams: [msg, ...s.teams], chat: [...chat, reply] };
    });

  // Cancara tells the line manager what they need to do for every week reached so far
  const notifyManagerOfActions = () =>
    setState((s) => {
      const currentWeek = PAGES[s.current].week;
      const actions = nextManagerActions(s.actionsSentUpTo + 1, Math.max(currentWeek, 0));
      if (actions.length === 0) {
        const msg: TeamsMessage = {
          id: newId('teams'),
          sentAt: now(),
          direction: 'to-manager',
          kind: 'action',
          text: 'Nothing new needs doing from you yet. Cancara will let you know when a check-in is due.',
        };
        return { ...s, teams: [msg, ...s.teams] };
      }
      const msg: TeamsMessage = {
        id: newId('teams'),
        sentAt: now(),
        direction: 'to-manager',
        kind: 'action',
        text: `Actions for you: ${actions.join(' · ')}`,
      };
      const chatReply: ChatMessage = {
        id: newId('msg'),
        from: 'cancara',
        text: `I have let ${MANAGER_FIRST_NAME} know about ${actions.length} action${actions.length === 1 ? '' : 's'} on Teams.`,
        sentAt: now(),
      };
      return { ...s, teams: [msg, ...s.teams], chat: [...s.chat, chatReply], actionsSentUpTo: currentWeek };
    });

  const reset = () => setState({ ...initial, lastVisit: now() });

  return {
    state,
    daysAway,
    register,
    goTo,
    completePage,
    toggleTask,
    shareProgress,
    requestCheckIn,
    askCancara,
    sendQuestionToManager,
    notifyManagerOfActions,
    reset,
  };
}
