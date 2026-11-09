import { useEffect, useState } from 'react';
import { PAGES } from './data';

const STORAGE_KEY = 'stride-journey-v2';

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
  // Last time the user opened Stride (ISO timestamp)
  lastVisit: string;
};

const initial: JourneyState = {
  registered: false,
  firstName: '',
  current: 0,
  completed: [],
  ticked: [],
  shares: [],
  checkIns: [],
  lastVisit: '',
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

export function useJourney() {
  // Read the saved state once so we can say how long it has been since the last visit
  const [boot] = useState(() => {
    const saved = load();
    const daysAway =
      saved.registered && saved.lastVisit
        ? Math.floor((Date.now() - new Date(saved.lastVisit).getTime()) / DAY_MS)
        : 0;
    return { state: { ...saved, lastVisit: new Date().toISOString() }, daysAway };
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
      return { ...s, completed, current: Math.min(s.current + 1, PAGES.length - 1) };
    });

  const toggleTask = (taskId: string) =>
    setState((s) => ({
      ...s,
      ticked: s.ticked.includes(taskId) ? s.ticked.filter((t) => t !== taskId) : [...s.ticked, taskId],
    }));

  const shareProgress = () =>
    setState((s) => {
      const page = PAGES[s.current];
      const share: ProgressShare = {
        id: `share-${Date.now()}`,
        sentAt: new Date().toISOString(),
        week: page.week,
        pageTitle: page.title,
      };
      return { ...s, shares: [share, ...s.shares] };
    });

  const requestCheckIn = (req: { date: string; time: string; topic: string }) =>
    setState((s) => {
      const checkIn: CheckInRequest = {
        id: `checkin-${Date.now()}`,
        week: PAGES[s.current].week,
        status: 'sent',
        ...req,
      };
      return { ...s, checkIns: [checkIn, ...s.checkIns] };
    });

  const reset = () => setState({ ...initial, lastVisit: new Date().toISOString() });

  return { state, daysAway, register, goTo, completePage, toggleTask, shareProgress, requestCheckIn, reset };
}
