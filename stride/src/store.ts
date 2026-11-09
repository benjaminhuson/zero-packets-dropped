import { useEffect, useState } from 'react';
import { PAGES } from './data';
import { answer, type ChatMessage } from './agent';
import { APPROACHING_DAYS, STAGES } from './stages';
import { LINE_MANAGER } from './data';

const STORAGE_KEY = 'stride-stages-v1';
const MANAGER = LINE_MANAGER.name.split(' ')[0];
const DAY_MS = 86400000;

export type Device = 'mac' | 'windows';

export interface Details {
  preferredName: string;
  mobile: string;
  personalEmail: string;
}

export type CheckInRequest = { id: string; date: string; time: string; topic: string; status: 'sent' };
export type ProgressShare = { id: string; sentAt: string; pageTitle: string };

export type TeamsMessage = {
  id: string;
  sentAt: string;
  direction: 'to-manager' | 'to-starter';
  kind: 'question' | 'action' | 'progress' | 'check-in' | 'reminder' | 'overdue' | 'stage';
  text: string;
};

// Everything the stage triggers depend on. Set by the starter, the manager, or a system event.
export interface Flow {
  accepted: boolean;
  details: Details | null;
  vettingComplete: boolean;
  stepsDone: string[];
  startDate: string | null; // YYYY-MM-DD, proposed by the starter
  starterAgreedDate: boolean;
  managerAgreedDate: boolean;
  noticeConfirmed: boolean;
  device: Device | null;
  photoName: string | null;
  objectives: string;
  upn: string | null; // set by the line manager in Entra ID
  laptopSent: boolean;
  emergencyContacts: string;
  // Demo overrides for date-based triggers, so the PoC can be shown without waiting
  demoApproaching: boolean;
  demoStarted: boolean;
}

export interface JourneyState {
  registered: boolean;
  firstName: string;
  flow: Flow;
  viewStage: number; // stage shown on screen
  announced: number[]; // stages the starter has been told are unlocked
  shares: ProgressShare[];
  checkIns: CheckInRequest[];
  teams: TeamsMessage[];
  chat: ChatMessage[];
  lastVisit: string;
}

const emptyFlow: Flow = {
  accepted: false,
  details: null,
  vettingComplete: false,
  stepsDone: [],
  startDate: null,
  starterAgreedDate: false,
  managerAgreedDate: false,
  noticeConfirmed: false,
  device: null,
  photoName: null,
  objectives: '',
  upn: null,
  laptopSent: false,
  emergencyContacts: '',
  demoApproaching: false,
  demoStarted: false,
};

const initial: JourneyState = {
  registered: false,
  firstName: '',
  flow: emptyFlow,
  viewStage: 0,
  announced: [],
  shares: [],
  checkIns: [],
  teams: [],
  chat: [],
  lastVisit: '',
};

function load(): JourneyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    const saved = JSON.parse(raw) as Partial<JourneyState>;
    return { ...initial, ...saved, flow: { ...emptyFlow, ...(saved.flow ?? {}) } };
  } catch {
    return initial;
  }
}

const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function daysUntil(dateStr: string, today: Date): number {
  const start = new Date(dateStr + 'T00:00:00').getTime();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((start - t) / DAY_MS);
}

// Each trigger, keyed by the stage it unlocks the NEXT stage from.
export function triggerMet(stageId: number, f: Flow, today: Date = new Date()): boolean {
  switch (stageId) {
    case 0: return f.accepted;
    case 1: return f.vettingComplete;
    case 2: return !!f.startDate && f.starterAgreedDate && f.managerAgreedDate;
    case 3: return !!f.photoName;
    case 4: return f.demoApproaching || (!!f.startDate && daysUntil(f.startDate, today) <= APPROACHING_DAYS);
    default: return false;
  }
}

// Highest stage the user may see. Stage n+1 unlocks when the trigger on stage n is met.
export function unlockedStage(f: Flow, today: Date = new Date()): number {
  let n = 0;
  while (n < STAGES.length - 1 && triggerMet(n, f, today)) n++;
  return n;
}

// Stage 5 has no trigger after it; it is finished when the start date is reached.
export function hasStarted(f: Flow, today: Date = new Date()): boolean {
  return f.demoStarted || (!!f.startDate && daysUntil(f.startDate, today) <= 0);
}

// Keep the starter informed when a new stage unlocks.
function announce(s: JourneyState): JourneyState {
  const unlocked = unlockedStage(s.flow);
  const fresh = [];
  for (let n = 0; n <= unlocked; n++) {
    if (!s.announced.includes(n) && n > 0) fresh.push(n);
  }
  if (fresh.length === 0) return s;
  const msgs: TeamsMessage[] = fresh.map((n) => ({
    id: newId('teams'),
    sentAt: now(),
    direction: 'to-starter',
    kind: 'stage',
    text: `Stage ${n} unlocked: ${STAGES[n].name}. ${STAGES[n].summary}`,
  }));
  return { ...s, announced: [...s.announced, ...fresh], teams: [...msgs, ...s.teams] };
}

export function useJourney() {
  const [boot] = useState(() => {
    const saved = load();
    return { state: { ...saved, lastVisit: now() } };
  });
  const [state, setState] = useState<JourneyState>(boot.state);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Every change goes through here so unlock announcements are always sent
  const update = (fn: (s: JourneyState) => JourneyState) => setState((s) => announce(fn(s)));
  const msg = (direction: TeamsMessage['direction'], kind: TeamsMessage['kind'], text: string): TeamsMessage => ({
    id: newId('teams'),
    sentAt: now(),
    direction,
    kind,
    text,
  });
  const patchFlow = (s: JourneyState, patch: Partial<Flow>): JourneyState => ({ ...s, flow: { ...s.flow, ...patch } });

  const register = (firstName: string) =>
    update((s) => {
      const withName = { ...s, registered: true, firstName: firstName.trim() || 'there' };
      return patchFlow(withName, { accepted: true });
    });

  const openStage = (stage: number) =>
    setState((s) => ({ ...s, viewStage: Math.max(0, Math.min(stage, unlockedStage(s.flow))) }));

  const toggleStep = (stepId: string) =>
    update((s) => {
      const done = s.flow.stepsDone.includes(stepId);
      return patchFlow(s, { stepsDone: done ? s.flow.stepsDone.filter((x) => x !== stepId) : [...s.flow.stepsDone, stepId] });
    });

  const saveDetails = (d: Details) => update((s) => patchFlow(s, { details: d }));

  const setDevice = (device: Device) => update((s) => patchFlow(s, { device }));

  const uploadPhoto = (name: string) => update((s) => patchFlow(s, { photoName: name }));

  const confirmNotice = () => update((s) => patchFlow(s, { noticeConfirmed: true }));

  const saveObjectives = (text: string) => update((s) => patchFlow(s, { objectives: text }));

  const saveContacts = (text: string) => update((s) => patchFlow(s, { emergencyContacts: text }));

  // The starter proposes a start date. Both parties must agree before stage 3 unlocks.
  const agreeStartDate = (date: string) =>
    update((s) => {
      const next = patchFlow(s, { startDate: date, starterAgreedDate: true, managerAgreedDate: false });
      return {
        ...next,
        teams: [msg('to-manager', 'action', `Please confirm the start date ${date} for ${s.firstName || 'the new starter'}.`), ...next.teams],
      };
    });

  // Demo event: the line manager confirms the agreed start date
  const managerConfirmDate = () =>
    update((s) => {
      const next = patchFlow(s, { managerAgreedDate: true });
      return { ...next, teams: [msg('to-starter', 'stage', `${MANAGER} confirmed your start date.`), ...next.teams] };
    });

  // Demo event: Workday completes vetting. This triggers stage 2.
  const completeVetting = () =>
    update((s) => {
      const next = patchFlow(s, { vettingComplete: true });
      return { ...next, teams: [msg('to-starter', 'stage', 'Vetting is complete. You can now move on to stage 2.'), ...next.teams] };
    });

  // Demo event: the line manager adds the new starter's UPN in Entra ID
  const managerSetUpn = (upn: string) =>
    update((s) => {
      const next = patchFlow(s, { upn: upn.trim() });
      return { ...next, teams: [msg('to-starter', 'stage', `${MANAGER} added your account in Microsoft Entra ID.`), ...next.teams] };
    });

  // Demo event: IT dispatches the laptop
  const dispatchLaptop = () =>
    update((s) => patchFlow(s, { laptopSent: true }));

  // Demo events for the date-based triggers
  const simulateApproaching = () => update((s) => patchFlow(s, { demoApproaching: true }));
  const simulateStarted = () => update((s) => patchFlow(s, { demoStarted: true }));

  const shareProgress = () =>
    update((s) => {
      const share: ProgressShare = { id: newId('share'), sentAt: now(), pageTitle: PAGES[0].title };
      const stageName = STAGES[s.viewStage].name;
      return { ...s, shares: [share, ...s.shares], teams: [msg('to-manager', 'progress', `${s.firstName || 'The new starter'} is on stage ${s.viewStage}: ${stageName}.`), ...s.teams] };
    });

  const requestCheckIn = (req: { date: string; time: string; topic: string }) =>
    update((s) => {
      const checkIn: CheckInRequest = { id: newId('checkin'), status: 'sent', ...req, topic: req.topic.trim() || 'Check-in' };
      return {
        ...s,
        checkIns: [checkIn, ...s.checkIns],
        teams: [msg('to-manager', 'check-in', `Check-in request for ${req.date} at ${req.time}: ${checkIn.topic}`), ...s.teams],
      };
    });

  const askCancara = (question: string) =>
    update((s) => {
      const stage = STAGES[s.viewStage];
      const reply = answer(question, 0, stage.name);
      const you: ChatMessage = { id: newId('msg'), from: 'you', text: question, sentAt: now() };
      const cancara: ChatMessage = { id: newId('msg'), from: 'cancara', text: reply.text, sentAt: now(), escalate: reply.escalate };
      return { ...s, chat: [...s.chat, you, cancara] };
    });

  const sendQuestionToManager = (question: string) =>
    update((s) => {
      const reply: ChatMessage = { id: newId('msg'), from: 'cancara', text: `Sent to ${MANAGER} on Teams. I will let you know when they reply.`, sentAt: now() };
      const chat = s.chat.map((m) => (m.escalate ? { ...m, escalate: false } : m));
      return { ...s, chat: [...chat, reply], teams: [msg('to-manager', 'question', question), ...s.teams] };
    });

  // Tell the manager which of their steps are waiting on them
  const notifyManagerOfActions = () =>
    update((s) => {
      const waiting: string[] = [];
      if (s.flow.startDate && s.flow.starterAgreedDate && !s.flow.managerAgreedDate) waiting.push('Confirm the agreed start date');
      if (unlockedStage(s.flow) >= 4 && !s.flow.upn) waiting.push('Add the new starter’s UPN in Microsoft Entra ID');
      const text = waiting.length ? `Actions for you: ${waiting.join(' · ')}` : 'Nothing is waiting on you right now.';
      return { ...s, teams: [msg('to-manager', 'action', text), ...s.teams] };
    });

  const reset = () => setState({ ...initial, lastVisit: now() });

  return {
    state,
    register,
    openStage,
    toggleStep,
    saveDetails,
    setDevice,
    uploadPhoto,
    confirmNotice,
    saveObjectives,
    saveContacts,
    agreeStartDate,
    managerConfirmDate,
    completeVetting,
    managerSetUpn,
    dispatchLaptop,
    simulateApproaching,
    simulateStarted,
    shareProgress,
    requestCheckIn,
    askCancara,
    sendQuestionToManager,
    notifyManagerOfActions,
    reset,
  };
}
