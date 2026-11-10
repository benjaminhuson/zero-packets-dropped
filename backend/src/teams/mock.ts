// Section 3: Teams mock. Records what would have been sent, so the rest of the system can be tested.
import type { TeamsGateway, TeamsNotice, UserId } from '../contracts.js';

export interface SentRecord {
  to: 'starter' | 'manager' | 'buddy';
  userId: UserId;
  text: string;
}

export class MockTeamsGateway implements TeamsGateway {
  readonly sent: SentRecord[] = [];

  async sendToStarter(userId: UserId, text: string | TeamsNotice) {
    this.sent.push({ to: 'starter', userId, text: typeof text === 'string' ? text : text.text });
  }
  async sendToManager(userId: UserId, text: string | TeamsNotice) {
    this.sent.push({ to: 'manager', userId, text: typeof text === 'string' ? text : text.text });
  }
  async sendToBuddy(userId: UserId, text: string | TeamsNotice) {
    this.sent.push({ to: 'buddy', userId, text: typeof text === 'string' ? text : text.text });
  }
  async createCheckInMeeting(_userId: UserId, _when: { date: string; time: string }, _topic: string) {
    return { joinUrl: null };
  }
}
