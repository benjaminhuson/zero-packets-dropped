import { createContext, useContext } from 'react';
import type { Person } from './api';

// The signed-in colleague's real line manager and buddy (from /api/me), for the journey screens.
// Empty in the offline prototype, where the screens fall back to data.ts.
export interface Team {
  manager: Person | null;
  buddy: Person | null;
}

export const TeamContext = createContext<Team>({ manager: null, buddy: null });
export const useTeam = () => useContext(TeamContext);
