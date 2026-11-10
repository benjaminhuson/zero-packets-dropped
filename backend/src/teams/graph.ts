// Section 3: real Teams delivery through the Stride bot, plus check-in meetings.
// Finds who to message from the colleague's Stride record (their linked UPN, manager UPN, buddy UPN), then the
// person's Teams contact (saved by the bot when the Stride app was added to their team or opened by them).
// Delivery is best effort: anyone not reachable in Teams yet is skipped and logged.
import type { StarterAccount, Store, TeamsGateway, TeamsNotice, UserId } from '../contracts.js';
import type { BotConnector } from './bot/connector.js';
import { noticeCard } from './bot/cards.js';
import { scheduleLink, type GraphMeetings } from './meetings.js';

export interface GraphTeamsOptions {
  store: Store;
  connector: BotConnector;
  meetings: GraphMeetings | null; // null: link mode
  appUrl: string;
}

type Who = 'starter' | 'manager' | 'buddy';

export class GraphTeamsGateway implements TeamsGateway {
  constructor(private readonly o: GraphTeamsOptions) {}

  sendToStarter(userId: UserId, text: string | TeamsNotice) {
    return this.deliver(userId, 'starter', text);
  }
  sendToManager(userId: UserId, text: string | TeamsNotice) {
    return this.deliver(userId, 'manager', text);
  }
  sendToBuddy(userId: UserId, text: string | TeamsNotice) {
    return this.deliver(userId, 'buddy', text);
  }

  async createCheckInMeeting(userId: UserId, when: { date: string; time: string }, topic: string) {
    const starter = await this.o.store.getStarter(userId);
    if (!starter) return { joinUrl: null };
    const name = `${starter.firstName} ${starter.lastName}`.trim();
    const req = {
      organiserUpn: starter.managerUpn,
      attendeeUpns: starter.entraLinkedAt && starter.upn ? [starter.upn] : [],
      date: when.date,
      time: when.time,
      minutes: 30,
      subject: `Stride check-in: ${name}`,
      body: `${name} asked for a check-in through Stride. Topic: ${topic}`,
    };
    if (this.o.meetings) {
      try {
        return { joinUrl: await this.o.meetings.create(req), scheduleUrl: undefined };
      } catch (err) {
        console.error('check-in meeting via Graph failed; falling back to a link:', err instanceof Error ? err.message : err);
      }
    }
    return { joinUrl: null, scheduleUrl: scheduleLink(req) };
  }

  private upnFor(starter: StarterAccount, who: Who): string | null {
    if (who === 'manager') return starter.managerUpn;
    if (who === 'buddy') return starter.buddyUpn;
    return starter.entraLinkedAt ? starter.upn : null; // no Teams until their Entra account is in use
  }

  private async deliver(userId: UserId, who: Who, message: string | TeamsNotice): Promise<void> {
    try {
      const starter = await this.o.store.getStarter(userId);
      const upn = starter && this.upnFor(starter, who);
      if (!upn) return;
      const contact = await this.o.store.getTeamsContact(upn);
      if (!contact) {
        console.log(`teams: ${who} for ${userId} has not got the Stride app yet; not sent`);
        return;
      }
      let conversationId = contact.conversationId;
      if (!conversationId) {
        conversationId = await this.o.connector.createPersonalConversation(contact.serviceUrl, contact.tenantId, contact.teamsUserId);
        await this.o.store.saveTeamsContact({ ...contact, conversationId });
      }
      const notice: TeamsNotice = typeof message === 'string'
        ? { title: 'Stride', text: message, link: { label: 'Open Stride', url: this.o.appUrl } }
        : { link: { label: 'Open Stride', url: this.o.appUrl }, ...message };
      await this.o.connector.send(contact.serviceUrl, conversationId, noticeCard(notice));
    } catch (err) {
      console.error(`teams: delivery to ${who} for ${userId} failed:`, err instanceof Error ? err.message : err);
    }
  }
}
