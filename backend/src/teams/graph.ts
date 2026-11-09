// Section 3 (Azure): Microsoft Graph / Teams bot delivery. Not implemented yet.
// Needs: a Teams app installed in the tenant, bot or Graph permissions, and admin consent.
// Ask the organisers for the consent step early (see README).
import type { TeamsGateway, UserId } from '../contracts.js';

export class GraphTeamsGateway implements TeamsGateway {
  private todo(): never {
    throw new Error('GraphTeamsGateway is not implemented yet');
  }
  sendToStarter(_userId: UserId, _text: string): Promise<void> { return this.todo(); }
  sendToManager(_userId: UserId, _text: string): Promise<void> { return this.todo(); }
  createCheckInMeeting(_userId: UserId, _when: { date: string; time: string }, _topic: string): Promise<{ joinUrl: string | null }> {
    return this.todo();
  }
}
