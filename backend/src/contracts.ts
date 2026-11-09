// SHARED CONTRACTS. Every section codes against these types and interfaces.
// Change them only through the section 1 owner (API & domain), and tell the others.

export type UserId = string;

// ---- Journey ----------------------------------------------------------------

export interface Journey {
  userId: UserId;
  firstName: string;
  createdAt: string; // ISO timestamp
  lastVisit: string; // ISO timestamp
  current: number; // index into PAGES
  completedPages: string[]; // page ids
  tickedTasks: string[]; // task ids
  consent: Consent | null;
  remindedWeeks: number[];
  nudgedTasks: string[];
  actionsSentUpTo: number;
}

export interface Consent {
  shareWithManager: boolean;
  wordingVersion: string; // which consent text the user saw
  givenAt: string; // ISO timestamp
}

// ---- Teams and messages ------------------------------------------------------

export type MessageKind = 'question' | 'action' | 'progress' | 'check-in' | 'reminder' | 'overdue';

export interface TeamsMessage {
  id: string;
  userId: UserId;
  sentAt: string;
  direction: 'to-manager' | 'to-starter';
  kind: MessageKind;
  text: string;
}

export interface CheckInRequest {
  id: string;
  userId: UserId;
  week: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  topic: string;
  status: 'sent';
}

// ---- Cancara chat -----------------------------------------------------------

export interface ChatTurn {
  id: string;
  userId: UserId;
  from: 'you' | 'cancara';
  text: string;
  sentAt: string;
  escalate?: boolean;
}

// ---- Gateways (interfaces each section implements) --------------------------

// Section 2: persistence
export interface Store {
  getJourney(userId: UserId): Promise<Journey | null>;
  saveJourney(journey: Journey): Promise<void>;
  listUserIds(): Promise<UserId[]>;
  appendMessage(message: TeamsMessage): Promise<void>;
  listMessages(userId: UserId): Promise<TeamsMessage[]>; // newest first
  addCheckIn(checkIn: CheckInRequest): Promise<void>;
  listCheckIns(userId: UserId): Promise<CheckInRequest[]>; // newest first
  appendChat(turn: ChatTurn): Promise<void>;
  listChat(userId: UserId): Promise<ChatTurn[]>; // oldest first
}

// Section 3: Teams and Microsoft Graph
export interface TeamsGateway {
  sendToStarter(userId: UserId, text: string): Promise<void>;
  sendToManager(userId: UserId, text: string): Promise<void>;
  // Creates a Teams meeting invitation to the line manager. Returns a join link when available.
  createCheckInMeeting(userId: UserId, when: { date: string; time: string }, topic: string): Promise<{ joinUrl: string | null }>;
}

// Section 4: Cancara (AI buddy)
export interface AgentGateway {
  answer(question: string, context: { week: number; pageTitle: string }): Promise<{ text: string; escalate: boolean }>;
}

// Shared utility
export interface Clock {
  now(): Date;
}
