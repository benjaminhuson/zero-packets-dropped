// Section 2: in-memory store for local runs and tests. Data is lost when the process stops.
import type { ChatTurn, CheckInRequest, Journey, Note, StarterAccount, StarterState, Store, TeamsMessage, UserId } from '../contracts.js';

export class MemoryStore implements Store {
  private journeys = new Map<UserId, Journey>();
  private messages: TeamsMessage[] = [];
  private checkIns: CheckInRequest[] = [];
  private chat: ChatTurn[] = [];
  private starters = new Map<UserId, StarterAccount>();
  private states = new Map<UserId, StarterState>();
  private notes: Note[] = [];

  async getJourney(userId: UserId) {
    return this.journeys.get(userId) ?? null;
  }
  async saveJourney(journey: Journey) {
    this.journeys.set(journey.userId, journey);
  }
  async listUserIds() {
    return [...this.journeys.keys()];
  }
  async appendMessage(message: TeamsMessage) {
    this.messages.unshift(message);
  }
  async listMessages(userId: UserId) {
    return this.messages.filter((m) => m.userId === userId);
  }
  async addCheckIn(checkIn: CheckInRequest) {
    this.checkIns.unshift(checkIn);
  }
  async listCheckIns(userId: UserId) {
    return this.checkIns.filter((c) => c.userId === userId);
  }
  async appendChat(turn: ChatTurn) {
    this.chat.push(turn);
  }
  async listChat(userId: UserId) {
    return this.chat.filter((t) => t.userId === userId);
  }

  async getStarter(id: UserId) {
    return this.starters.get(id) ?? null;
  }
  async saveStarter(account: StarterAccount) {
    this.starters.set(account.id, account);
  }
  async findStarterByEmail(email: string) {
    return [...this.starters.values()].find((s) => s.email === email) ?? null;
  }
  async findStarterByUpn(upn: string) {
    return [...this.starters.values()].find((s) => s.upn === upn) ?? null;
  }
  async findStarterByInvite(inviteHash: string) {
    return [...this.starters.values()].find((s) => s.inviteHash === inviteHash) ?? null;
  }
  async listStartersForStaff(upn: string) {
    return [...this.starters.values()].filter((s) => s.managerUpn === upn || s.buddyUpn === upn);
  }
  async getStarterState(userId: UserId) {
    return this.states.get(userId) ?? null;
  }
  async saveStarterState(state: StarterState) {
    this.states.set(state.userId, state);
  }
  async appendNote(note: Note) {
    this.notes.push(note);
  }
  async listNotes(starterId: UserId) {
    return this.notes.filter((n) => n.starterId === starterId);
  }
}
