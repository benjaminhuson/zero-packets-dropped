// Section 3: Teams mock. Records what would have been sent, so the rest of the system can be tested.
import type { TeamsGateway, UserId } from '../contracts.js';

export interface SentRecord {
  to: 'starter' | 'manager';
  userId: UserId;
  text: string;
}

export class MockTeamsGateway implements TeamsGateway {
  readonly sent: SentRecord[] = [];

  async sendToStarter(userId: UserId, text: string) {
    this.sent.push({ to: 'starter', userId, text });
  }
  async sendToManager(userId: UserId, text: string) {
    this.sent.push({ to: 'manager', userId, text });
  }
  async createCheckInMeeting(_userId: UserId, _when: { date: string; time: string }, _topic: string) {
    return { joinUrl: null };
  }
}
