import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { PAGES } from './data';
import { answer, type ChatMessage } from './agent';
import { APPROACHING_DAYS, STAGES } from './stages';
import { freeSlots, type Slot } from './calendar';

const STORAGE_KEY = 'stride-stages-v1';
const MANAGER = 'your manager';
const DAY_MS = 86400000;

export type Device = 'standard-mac' | 'developer-mac' | 'windows';
export type WorkLocation = 'leeds' | 'london' | 'virtual';

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
  direction: 'to-manager' | 'to-buddy' | 'to-starter';
  kind: 'question' | 'action' | 'progress' | 'check-in' | 'reminder' | 'overdue' | 'stage' | 'message';
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
  upn: string | null; // work email address, set up by the line manager
  laptopSent: boolean;
  emergencyContacts: string;
  location: WorkLocation | null; // where the starter works, agreed with their manager
  // Demo overrides for date-based triggers, so the PoC can be shown without waiting
  demoApproaching: boolean;
  demoStarted: boolean;
}

export interface JourneyState {
  registered: boolean;
  firstName: string;
  flow: Flow;
  viewStage: number; // stage shown on screen
  welcomed: boolean; // has seen the first-visit welcome
  celebrate: number | null; // stage just unlocked, shown as a congratulations banner
  checkinPrompted: number[]; // stages where Cancara has offered a check-in
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
  location: null,
  demoApproaching: false,
  demoStarted: false,
};

const initial: JourneyState = {
  registered: false,
  firstName: '',
  flow: emptyFlow,
  viewStage: 0,
  welcomed: false,
  celebrate: null,
  checkinPrompted: [],
  announced: [],
  shares: [],
  checkIns: [],
  teams: [],
  chat: [],
  lastVisit: '',
};

function hydrate(saved: Partial<JourneyState> | null | undefined): JourneyState {
  if (!saved) return initial;
  return { ...initial, ...saved, flow: { ...emptyFlow, ...(saved.flow ?? {}) } };
}

function load(key: string): JourneyState {
  try {
    const raw = localStorage.getItem(key);
    return raw ? hydrate(JSON.parse(raw) as Partial<JourneyState>) : initial;
  } catch {
    return initial;
  }
}

// What the line manager and buddy may see. The rest of the state stays the colleague's own.
export function summarise(s: JourneyState) {
  const stage = unlockedStage(s.flow);
  return {
    stage,
    stageName: STAGES[stage]?.name ?? '',
    stagesTotal: STAGES.length,
    stepsDone: s.flow.stepsDone.length,
    startDate: s.flow.startDate,
  };
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

const cancaraMsg = (text: string, action?: ChatMessage['action']): ChatMessage => ({
  id: newId('msg'),
  from: 'cancara',
  text,
  sentAt: now(),
  ...(action ? { action } : {}),
});


// Keep the starter informed when a new stage unlocks. Updates go to the Cancara chat.
function announce(s: JourneyState): JourneyState {
  const unlocked = unlockedStage(s.flow);
  const fresh = [];
  for (let n = 0; n <= unlocked; n++) {
    if (!s.announced.includes(n) && n > 0) fresh.push(n);
  }
  if (fresh.length === 0) return s;
  const msgs: Pick<TeamsMessage, 'text'>[] = fresh.map((n) => ({
    id: newId('teams'),
    sentAt: now(),
    direction: 'to-starter',
    kind: 'stage',
    text: `Stage ${n} unlocked: ${STAGES[n].name}. ${STAGES[n].summary}`,
  }));
  const chatMsgs = msgs.map((m) => cancaraMsg(m.text));
  return { ...s, announced: [...s.announced, ...fresh], chat: [...s.chat, ...chatMsgs], celebrate: Math.max(...fresh) };
}

// userId: the signed-in colleague (state is saved to the Stride API as well as this browser).
// Without one, the prototype runs offline in this browser only, as before.
export function useJourney(userId?: string) {
  const key = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
  const [boot] = useState(() => {
    const saved = load(key);
    return { state: { ...saved, lastVisit: now() } };
  });
  const [state, setState] = useState<JourneyState>(boot.state);
  const [synced, setSynced] = useState(!userId); // don't save to the server until we have loaded from it

  // Signed in: the server copy wins, so the journey follows the colleague across devices.
  useEffect(() => {
    if (!userId) return;
    let live = true;
    api.loadState<Partial<JourneyState>>()
      .then((saved) => { if (live && saved?.state) setState({ ...hydrate(saved.state), lastVisit: now() }); })
      .catch((err) => console.warn('Could not load saved journey', err))
      .finally(() => { if (live) setSynced(true); });
    return () => { live = false; };
  }, [userId]);

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* storage full or blocked */ }
  }, [key, state]);

  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!userId || !synced) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      api.saveState(state, summarise(state)).catch((err) => console.warn('Could not save journey', err));
    }, 800);
    return () => window.clearTimeout(timer.current);
  }, [userId, synced, state]);

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

  const setLocation = (location: WorkLocation) => update((s) => patchFlow(s, { location }));

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
      return { ...next, chat: [...next.chat, cancaraMsg(`${MANAGER} confirmed your start date.`)] };
    });

  // Demo event: Workday completes vetting. This triggers stage 2.
  const completeVetting = () =>
    update((s) => {
      const next = patchFlow(s, { vettingComplete: true });
      return { ...next, chat: [...next.chat, cancaraMsg('Vetting is complete. You can now move on to stage 2.')] };
    });

  // Event: the line manager sets up the new starter's work email address
  const managerSetUpn = (upn: string) =>
    update((s) => {
      const next = patchFlow(s, { upn: upn.trim() });
      return { ...next, chat: [...next.chat, cancaraMsg(`${MANAGER} has set up your work email address. You will need it to sign in when your laptop arrives.`)] };
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
      const unlocked = unlockedStage(s.flow);
      // "Book a Teams meeting": offer free slots from the manager's diary, to book with one tap
      if (/\b(book|arrange|set up|schedule)\b.*\b(meeting|check-?in|catch-?up|call)\b|\bteams meeting\b/i.test(question)) {
        const slots = freeSlots(new Date(), { count: 3 });
        const you: ChatMessage = { id: newId('msg'), from: 'you', text: question, sentAt: now() };
        const offer = cancaraMsg(
          slots.length
            ? `Here are some free times in your manager’s diary. Pick one and I will send the Teams meeting invite.`
            : 'I cannot see any free times in the next few days. Please ask your manager directly on Teams.',
          slots.length ? { kind: 'checkin', stage: s.viewStage, slots } : undefined,
        );
        return { ...s, chat: [...s.chat, you, offer] };
      }
      const asksWhere = /where\s+(am|are)\s+(i|we)|my\s+progress|what\s+stage|which\s+stage/i.test(question);
      const reply = asksWhere
        ? {
            text: `You are in Stage ${s.viewStage}: ${stage.name}. ${
              unlocked < STAGES.length - 1
                ? `The next stage, ${STAGES[unlocked + 1].name}, unlocks when: ${STAGES[unlocked].trigger.toLowerCase()}.`
                : 'You have reached the final stage.'
            }`,
            escalate: false,
          }
        : answer(question, 0, stage.name);
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

  // Cancara passes a message from the starter to their manager or buddy on Teams
  const messageSomeone = (who: 'manager' | 'buddy', text: string) =>
    update((s) => {
      const name = who === 'manager' ? (MANAGER === 'your manager' ? 'your manager' : MANAGER) : 'your buddy';
      const reply: ChatMessage = { id: newId('msg'), from: 'cancara', text: `Sent to ${name} on Teams. I will let you know when they reply.`, sentAt: now() };
      return { ...s, chat: [...s.chat, reply], teams: [msg(who === 'manager' ? 'to-manager' : 'to-buddy', 'message', text), ...s.teams] };
    });

  // Tell the manager which of their steps are waiting on them
  const notifyManagerOfActions = () =>
    update((s) => {
      const waiting: string[] = [];
      if (s.flow.startDate && s.flow.starterAgreedDate && !s.flow.managerAgreedDate) waiting.push('Confirm the agreed start date');
      if (unlockedStage(s.flow) >= 4 && !s.flow.upn) waiting.push('Set up the new starter’s work email address');
      const text = waiting.length ? `Actions for you: ${waiting.join(' · ')}` : 'Nothing is waiting on you right now.';
      return { ...s, teams: [msg('to-manager', 'action', text), ...s.teams] };
    });

  const markWelcomed = () => setState((s) => ({ ...s, welcomed: true }));

  // At the end of a stage, Cancara offers a check-in with the line manager. Offered once per stage.
  const promptCheckIn = (stage: number) =>
    update((s) => {
      if (s.checkinPrompted.includes(stage)) return s;
      const next = STAGES[stage + 1]?.name ?? 'the next stage';
      const slots = freeSlots(new Date(), { count: 3 });
      return {
        ...s,
        checkinPrompted: [...s.checkinPrompted, stage],
        chat: [
          ...s.chat,
          cancaraMsg(
            `You have finished ${STAGES[stage].name}. Before ${next}, would you like a check-in with ${MANAGER}? These times are free in ${MANAGER}’s diary.`,
            { kind: 'checkin', stage, slots },
          ),
        ],
      };
    });

  // Book the check-in from Cancara's offer, and confirm it in the chat.
  const bookCheckInFromChat = (stage: number, slot: Slot) =>
    update((s) => {
      const { date, time } = slot;
      const checkIn: CheckInRequest = { id: newId('checkin'), status: 'sent', date, time, topic: `${STAGES[stage].name} check-in` };
      const withoutOffer = s.chat.map((m) => (m.action?.kind === 'checkin' && m.action.stage === stage ? { ...m, action: undefined } : m));
      return {
        ...s,
        checkIns: [checkIn, ...s.checkIns],
        chat: [
          ...withoutOffer,
          cancaraMsg(`Done. I have sent ${MANAGER} a check-in invite for ${slot.label} on Teams.`),
        ],
        teams: [msg('to-manager', 'check-in', `Check-in request for ${date} at ${time}: ${checkIn.topic}`), ...s.teams],
      };
    });
  const dismissCelebrate = () => setState((s) => ({ ...s, celebrate: null }));

  const reset = () => setState({ ...initial, lastVisit: now() });

  return {
    state,
    register,
    openStage,
    markWelcomed,
    promptCheckIn,
    bookCheckInFromChat,
    freeSlots,
    dismissCelebrate,
    toggleStep,
    saveDetails,
    setDevice,
    uploadPhoto,
    confirmNotice,
    saveObjectives,
    saveContacts,
    setLocation,
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
    messageSomeone,
    notifyManagerOfActions,
    reset,
  };
}
