import { useEffect, useState } from 'react';
import { CHECKPOINTS, CHECKLIST } from './data';

const STORAGE_KEY = 'stride-journey-v1';

export type JourneyState = {
  registered: boolean;
  firstName: string;
  // Index into CHECKPOINTS of the checkpoint currently being viewed
  current: number;
  // Checkpoint ids that have been marked complete
  completed: string[];
  // Checklist task ids that have been ticked off
  ticked: string[];
};

const initial: JourneyState = {
  registered: false,
  firstName: '',
  current: 0,
  completed: [],
  ticked: [],
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

// The furthest checkpoint the user can reach: every checkpoint up to and including
// the first incomplete one is unlocked.
export function furthestUnlocked(completed: string[]): number {
  const firstIncomplete = CHECKPOINTS.findIndex((c) => !completed.includes(c.id));
  return firstIncomplete === -1 ? CHECKPOINTS.length - 1 : firstIncomplete;
}

export function useJourney() {
  const [state, setState] = useState<JourneyState>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const register = (firstName: string) =>
    setState((s) => ({ ...s, registered: true, firstName: firstName.trim() || 'there' }));

  const goTo = (index: number) =>
    setState((s) => ({ ...s, current: Math.max(0, Math.min(index, furthestUnlocked(s.completed))) }));

  const completeCurrent = () =>
    setState((s) => {
      const id = CHECKPOINTS[s.current].id;
      const completed = s.completed.includes(id) ? s.completed : [...s.completed, id];
      const next = Math.min(s.current + 1, CHECKPOINTS.length - 1);
      return { ...s, completed, current: next };
    });

  const toggleTask = (taskId: string) =>
    setState((s) => ({
      ...s,
      ticked: s.ticked.includes(taskId) ? s.ticked.filter((t) => t !== taskId) : [...s.ticked, taskId],
    }));

  const reset = () => setState(initial);

  const doneCount = state.ticked.filter((t) => CHECKLIST.some((c) => c.id === t)).length;

  return { state, register, goTo, completeCurrent, toggleTask, reset, doneCount };
}
