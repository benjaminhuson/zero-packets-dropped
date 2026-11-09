// Use cases. Combines the pure domain rules with the store and the gateways.
// Section 1 owns this file. Keep HTTP details out of it.
import { PAGES, TASKS, TOTAL_WEEKS, MANAGER_NAME, weekOfGroup } from '../content/journey.js';
import type { AgentGateway, ChatTurn, CheckInRequest, Clock, Journey, MessageKind, Store, TeamsGateway, TeamsMessage, UserId } from '../contracts.js';
import { completeCurrentPage, furthestUnlocked, newJourney, pendingManagerActions, toggleTask, weekEntryDrafts, type MessageDraft } from '../domain/journey.js';

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const MANAGER_FIRST = MANAGER_NAME.split(' ')[0];
const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export class JourneyService {
  constructor(
    private readonly store: Store,
    private readonly teams: TeamsGateway,
    private readonly agent: AgentGateway,
    private readonly clock: Clock,
  ) {}

  // ---- Journey -------------------------------------------------------------

  async register(userId: UserId, firstName: string): Promise<Journey> {
    const existing = await this.store.getJourney(userId);
    if (existing) return existing;
    const journey = newJourney(userId, firstName, this.clock.now());
    await this.store.saveJourney(journey);
    return journey;
  }

  async getJourney(userId: UserId): Promise<Journey> {
    const journey = await this.store.getJourney(userId);
    if (!journey) throw new HttpError(404, 'No journey for this user. Register first.');
    return journey;
  }

  async completePage(userId: UserId): Promise<Journey> {
    const journey = await this.getJourney(userId);
    const result = completeCurrentPage(journey, this.clock.now());
    await this.store.saveJourney(result.journey);
    await this.raise(userId, result.drafts);
    return result.journey;
  }

  async openPage(userId: UserId, index: number): Promise<Journey> {
    const journey = await this.getJourney(userId);
    const clamped = Math.max(0, Math.min(index, furthestUnlocked(journey.completedPages)));
    const updated = { ...journey, current: clamped, lastVisit: this.clock.now().toISOString() };
    await this.store.saveJourney(updated);
    return updated;
  }

  async toggleTask(userId: UserId, taskId: string): Promise<Journey> {
    if (!TASKS.some((t) => t.id === taskId)) throw new HttpError(400, `Unknown task: ${taskId}`);
    const journey = await this.getJourney(userId);
    const updated = toggleTask(journey, taskId);
    await this.store.saveJourney(updated);
    return updated;
  }

  // ---- Consent ---------------------------------------------------------------

  async setConsent(userId: UserId, shareWithManager: boolean, wordingVersion: string): Promise<Journey> {
    const journey = await this.getJourney(userId);
    const updated: Journey = {
      ...journey,
      consent: { shareWithManager, wordingVersion, givenAt: this.clock.now().toISOString() },
    };
    await this.store.saveJourney(updated);
    return updated;
  }

  // ---- Teams: messages to the line manager -----------------------------------

  async shareProgress(userId: UserId): Promise<TeamsMessage> {
    const journey = await this.getJourney(userId);
    const page = PAGES[journey.current];
    const where = page.week === 0 ? 'Offer day' : `Week ${page.week}`;
    return this.toManager(userId, 'progress', `${journey.firstName} is on ${where}: ${page.title}.`);
  }

  async requestCheckIn(userId: UserId, req: { date: string; time: string; topic: string }): Promise<CheckInRequest> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.date) || !/^\d{2}:\d{2}$/.test(req.time)) {
      throw new HttpError(400, 'date must be YYYY-MM-DD and time HH:MM');
    }
    const journey = await this.getJourney(userId);
    const topic = req.topic.trim() || 'Check-in';
    const link = await this.teams.createCheckInMeeting(userId, { date: req.date, time: req.time }, topic);
    const checkIn: CheckInRequest = {
      id: newId('checkin'),
      userId,
      week: PAGES[journey.current].week,
      date: req.date,
      time: req.time,
      topic,
      status: 'sent',
    };
    await this.store.addCheckIn(checkIn);
    await this.toManager(userId, 'check-in', `Check-in request for ${req.date} at ${req.time}: ${topic}${link.joinUrl ? ` (${link.joinUrl})` : ''}`);
    return checkIn;
  }

  async questionToManager(userId: UserId, question: string): Promise<TeamsMessage> {
    return this.toManager(userId, 'question', question);
  }

  async notifyManagerOfActions(userId: UserId): Promise<TeamsMessage> {
    const journey = await this.getJourney(userId);
    const throughWeek = PAGES[journey.current].week;
    const actions = pendingManagerActions(journey, throughWeek);
    const text = actions.length
      ? `Actions for you: ${actions.join(' · ')}`
      : 'Nothing new needs doing from you yet.';
    const message = await this.toManager(userId, 'action', text);
    if (actions.length) {
      await this.store.saveJourney({ ...journey, actionsSentUpTo: throughWeek });
    }
    return message;
  }

  // ---- Teams: messages to the starter (reminders, nudges) -------------------------

  // Idempotent catch-up for the current week. Safe to run on a schedule.
  async catchUpCurrentWeek(userId: UserId): Promise<MessageDraft[]> {
    const journey = await this.getJourney(userId);
    const week = PAGES[journey.current].week;
    const entry = weekEntryDrafts(journey, week);
    await this.store.saveJourney({ ...journey, ...entry.next });
    await this.raise(userId, entry.drafts);
    return entry.drafts;
  }

  // ---- Cancara ---------------------------------------------------------------

  async ask(userId: UserId, question: string): Promise<ChatTurn[]> {
    const journey = await this.getJourney(userId);
    const page = PAGES[journey.current];
    const reply = await this.agent.answer(question, { week: page.week, pageTitle: page.title });
    const now = this.clock.now().toISOString();
    const you: ChatTurn = { id: newId('msg'), userId, from: 'you', text: question, sentAt: now };
    const cancara: ChatTurn = { id: newId('msg'), userId, from: 'cancara', text: reply.text, sentAt: now, escalate: reply.escalate };
    await this.store.appendChat(you);
    await this.store.appendChat(cancara);
    return [you, cancara];
  }

  // ---- Reads -------------------------------------------------------------------

  async listMessages(userId: UserId): Promise<TeamsMessage[]> {
    await this.getJourney(userId);
    return this.store.listMessages(userId);
  }

  async listChat(userId: UserId): Promise<ChatTurn[]> {
    await this.getJourney(userId);
    return this.store.listChat(userId);
  }

  // What the line manager is allowed to see. Nothing if the starter has not consented to sharing.
  async managerSummary(userId: UserId) {
    const journey = await this.getJourney(userId);
    if (!journey.consent?.shareWithManager) {
      throw new HttpError(403, 'The new starter has not agreed to share progress with their manager.');
    }
    const week = PAGES[journey.current].week;
    const tasks = TASKS.filter((t) => weekOfGroup(t.group) === week);
    const checkIns = await this.store.listCheckIns(userId);
    return {
      currentWeek: week === 0 ? 'Offer day' : `Week ${week} of ${TOTAL_WEEKS}`,
      tasksDone: tasks.filter((t) => journey.tickedTasks.includes(t.id)).length,
      tasksTotal: tasks.length,
      checkInRequests: checkIns.length,
      notShared: ['personal notes', 'reflections'],
    };
  }

  // ---- Internals -------------------------------------------------------------

  private async toManager(userId: UserId, kind: MessageKind, text: string): Promise<TeamsMessage> {
    const journey = await this.getJourney(userId);
    if (!journey.consent?.shareWithManager) {
      throw new HttpError(403, `Not sent: the new starter has not agreed to share progress with ${MANAGER_FIRST}.`);
    }
    return this.record(userId, { direction: 'to-manager', kind, text });
  }

  // Store every draft as a message and deliver it to Teams.
  private async raise(userId: UserId, drafts: MessageDraft[]): Promise<void> {
    for (const draft of drafts) {
      if (draft.direction === 'to-manager') {
        const journey = await this.getJourney(userId);
        if (!journey.consent?.shareWithManager) continue; // consent gate: manager messages are skipped
      }
      await this.record(userId, draft);
    }
  }

  private async record(userId: UserId, draft: MessageDraft): Promise<TeamsMessage> {
    const message: TeamsMessage = {
      id: newId('teams'),
      userId,
      sentAt: this.clock.now().toISOString(),
      direction: draft.direction,
      kind: draft.kind,
      text: draft.text,
    };
    await this.store.appendMessage(message);
    if (draft.direction === 'to-manager') await this.teams.sendToManager(userId, draft.text);
    else await this.teams.sendToStarter(userId, draft.text);
    return message;
  }
}
