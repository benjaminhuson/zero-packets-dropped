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

// ---- People and sign-in -----------------------------------------------------
// A new colleague gets a Stride account before they have Entra ID. The line manager creates it and
// hands over a one-time invite code. Once the colleague's Entra account exists, the manager links its
// UPN, and from the first Entra sign-in Stride uses Entra only. Managers and buddies always use Entra.

export interface StarterAccount {
  id: UserId; // also the journey userId
  firstName: string;
  lastName: string;
  email: string; // sign-in name before Entra (synthetic data only), lowercased
  passwordHash: string | null; // scrypt, set when the invite is redeemed
  inviteHash: string | null; // sha256 of the one-time invite code
  inviteExpiresAt: string | null;
  managerUpn: string; // lowercased Entra UPN of the line manager
  buddyUpn: string | null; // lowercased Entra UPN of the buddy
  upn: string | null; // the colleague's own Entra UPN, once the manager links it
  entraLinkedAt: string | null; // first Entra sign-in; local password sign-in stops after this
  createdAt: string;
}

export type Relationship = 'manager' | 'buddy';

// Who is calling. Resolved from the Entra principal (App Service authentication) or the Stride session.
export type Caller =
  | { kind: 'starter'; userId: UserId; name: string; via: 'stride' | 'entra' }
  | { kind: 'staff'; upn: string; name: string };

// What the starter's app last saved. The front end owns the shape; the summary is what staff may see.
export interface StarterState {
  userId: UserId;
  savedAt: string;
  state: unknown;
  summary: StarterSummary;
}

export interface StarterSummary {
  stage: number;
  stageName: string;
  stagesTotal: number;
  stepsDone: number;
  startDate: string | null;
}

// Basic comms: one thread per starter, shared by the starter, their manager and their buddy.
export interface Note {
  id: string;
  starterId: UserId;
  from: 'starter' | Relationship;
  fromName: string;
  text: string;
  sentAt: string;
}

// ---- Teams ------------------------------------------------------------------------
// How the Stride bot reaches a person in Teams. Saved when the Stride Teams app is added to a team or
// opened by the user; the bot can then message them one-to-one.
export interface TeamsContact {
  upn: string; // lowercased
  aadObjectId: string;
  teamsUserId: string; // "29:..." id used by the Bot Connector
  name: string;
  serviceUrl: string;
  tenantId: string;
  conversationId: string | null; // the one-to-one chat with the bot, once created
  updatedAt: string;
}

// A Teams message with an optional button.
export interface TeamsNotice {
  title: string;
  text: string;
  link?: { label: string; url: string };
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

  getStarter(id: UserId): Promise<StarterAccount | null>;
  saveStarter(account: StarterAccount): Promise<void>;
  findStarterByEmail(email: string): Promise<StarterAccount | null>;
  findStarterByUpn(upn: string): Promise<StarterAccount | null>;
  findStarterByInvite(inviteHash: string): Promise<StarterAccount | null>;
  listStartersForStaff(upn: string): Promise<StarterAccount[]>; // as manager or buddy
  getStarterState(userId: UserId): Promise<StarterState | null>;
  saveStarterState(state: StarterState): Promise<void>;
  appendNote(note: Note): Promise<void>;
  listNotes(starterId: UserId): Promise<Note[]>; // oldest first
  getTeamsContact(upn: string): Promise<TeamsContact | null>;
  saveTeamsContact(contact: TeamsContact): Promise<void>;
}

// Section 3: Teams and Microsoft Graph. userId is always the new colleague's id; the gateway finds the
// right person (the colleague, their manager or their buddy). Delivery is best effort: someone who is
// not in Teams yet is skipped, and a Teams failure never fails the Stride action.
export interface TeamsGateway {
  sendToStarter(userId: UserId, text: string | TeamsNotice): Promise<void>;
  sendToManager(userId: UserId, text: string | TeamsNotice): Promise<void>;
  sendToBuddy(userId: UserId, text: string | TeamsNotice): Promise<void>;
  // A Teams meeting with the line manager. joinUrl when the meeting was created (Graph); otherwise
  // scheduleUrl opens a pre-filled "new meeting" form in Teams for the manager to send.
  createCheckInMeeting(userId: UserId, when: { date: string; time: string }, topic: string): Promise<{ joinUrl: string | null; scheduleUrl?: string }>;
}

// Section 4: Cancara (guide)
export interface AgentGateway {
  answer(question: string, context: { week: number; pageTitle: string }): Promise<{ text: string; escalate: boolean }>;
}

// Shared utility
export interface Clock {
  now(): Date;
}
