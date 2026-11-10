// Section 3: what the Stride bot does with activities from Teams.
//   - App added to a team: save every member as a contact, so Stride can message them one-to-one.
//   - App added personally, or a user messages the bot: save that user.
//   - A message: reply with a short help text and a button to open Stride.
import type { Store, TeamsContact } from '../../contracts.js';
import type { Activity, BotConnector, ChannelAccount } from './connector.js';
import { noticeCard } from './cards.js';

export interface BotContext {
  store: Store;
  connector: BotConnector;
  appUrl: string; // where Stride lives, for "Open Stride" buttons
  now: () => Date;
}

function contactFrom(member: ChannelAccount, serviceUrl: string, tenantId: string, now: Date, conversationId: string | null): TeamsContact | null {
  const upn = (member.userPrincipalName ?? member.email ?? '').toLowerCase();
  if (!upn || !member.aadObjectId) return null;
  return {
    upn,
    aadObjectId: member.aadObjectId,
    teamsUserId: member.id,
    name: member.name ?? upn,
    serviceUrl,
    tenantId,
    conversationId,
    updatedAt: now.toISOString(),
  };
}

async function save(ctx: BotContext, contact: TeamsContact | null) {
  if (!contact) return;
  const existing = await ctx.store.getTeamsContact(contact.upn);
  // Keep a known one-to-one chat id unless this activity gives us a newer one.
  await ctx.store.saveTeamsContact({ ...contact, conversationId: contact.conversationId ?? existing?.conversationId ?? null });
}

export async function handleActivity(activity: Activity, ctx: BotContext): Promise<void> {
  const serviceUrl = activity.serviceUrl;
  const tenantId = activity.channelData?.tenant?.id ?? activity.conversation?.tenantId;
  if (!serviceUrl || !tenantId || tenantId !== ctx.connector.tenantId) return; // other tenants are ignored
  const now = ctx.now();
  const personal = activity.conversation?.conversationType === 'personal';
  const teamId = activity.channelData?.team?.id;

  if (activity.type === 'conversationUpdate' || activity.type === 'installationUpdate') {
    if (teamId) {
      // Added to a team (or members joined it): refresh the whole roster.
      const members = await ctx.connector.listTeamMembers(serviceUrl, teamId);
      for (const m of members) await save(ctx, contactFrom(m, serviceUrl, tenantId, now, null));
      return;
    }
    if (personal && activity.from && activity.conversation) {
      const member = await ctx.connector.getMember(serviceUrl, activity.conversation.id, activity.from.id);
      await save(ctx, contactFrom(member, serviceUrl, tenantId, now, activity.conversation.id));
      if (activity.type === 'installationUpdate' && activity.action === 'add') {
        await ctx.connector.send(serviceUrl, activity.conversation.id, noticeCard({
          title: 'Welcome to Stride',
          text: "I'll message you here when there's something to do: reminders, check-ins, and messages from your new colleague's team thread.",
          link: { label: 'Open Stride', url: ctx.appUrl },
        }));
      }
    }
    return;
  }

  if (activity.type === 'message' && activity.conversation && activity.from) {
    if (personal) {
      const member = await ctx.connector.getMember(serviceUrl, activity.conversation.id, activity.from.id);
      await save(ctx, contactFrom(member, serviceUrl, tenantId, now, activity.conversation.id));
    }
    await ctx.connector.send(serviceUrl, activity.conversation.id, noticeCard({
      title: 'Stride',
      text: "I send Stride notifications: reminders, actions for line managers, check-in requests and team thread messages. To reply or see progress, open Stride.",
      link: { label: 'Open Stride', url: ctx.appUrl },
    }));
  }
}
