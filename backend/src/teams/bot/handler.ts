// Section 3: what the Stride bot does with activities from Teams.
//   - App added to a team: save every member as a contact, so Stride can message them one-to-one.
//   - App added personally, or a user messages the bot: save that user.
//   - A card's Reply button: post the reply to the colleague's team thread, as the person who pressed it.
//   - Any other message: reply with a short help text and a button to open Stride.
import type { Caller, Note, Store, TeamsContact, UserId } from '../../contracts.js';
import type { Activity, BotConnector, ChannelAccount } from './connector.js';
import { noticeCard, repliedCard, type ReplyData } from './cards.js';

export interface BotContext {
  store: Store;
  connector: BotConnector;
  appUrl: string; // where Stride lives, for "Open Stride" buttons
  now: () => Date;
  // Posts to a colleague's team thread with Stride's normal access rules (PeopleService.postNote).
  postNote: (caller: Caller, starterId: UserId, text: string) => Promise<Note>;
}

function isReply(value: unknown): value is ReplyData {
  const v = value as Partial<ReplyData> | null;
  return !!v && v.stride === 'reply' && typeof v.starterId === 'string';
}

// Who pressed the button, as Stride sees them: a linked colleague (after their first Microsoft sign-in) or staff.
async function callerFor(member: ChannelAccount, store: Store): Promise<Caller | null> {
  const upn = (member.userPrincipalName ?? member.email ?? '').toLowerCase();
  if (!upn) return null;
  const linked = await store.findStarterByUpn(upn);
  if (linked?.entraLinkedAt) return { kind: 'starter', userId: linked.id, name: linked.firstName, via: 'entra' };
  return { kind: 'staff', upn, name: member.name ?? upn.split('@')[0] };
}

async function handleReply(activity: Activity, data: ReplyData, ctx: BotContext, serviceUrl: string): Promise<void> {
  const conversationId = activity.conversation!.id;
  const say = (title: string, text: string) => ctx.connector.send(serviceUrl, conversationId, noticeCard({ title, text }));
  const text = (data.reply ?? '').trim();
  if (!text) return void (await say('Nothing sent', 'Type your reply in the box, then press Reply.'));

  const member = await ctx.connector.getMember(serviceUrl, conversationId, activity.from!.id);
  const caller = await callerFor(member, ctx.store);
  if (!caller || (caller.kind === 'starter' && caller.userId !== data.starterId)) {
    return void (await say('Not sent', "You can't reply to this conversation from your account."));
  }
  const body = data.quote ? `Re: "${data.quote.slice(0, 80)}${data.quote.length > 80 ? '…' : ''}" ${text}` : text;
  try {
    await ctx.postNote(caller, data.starterId, body);
  } catch (err) {
    const status = (err as { status?: number }).status;
    return void (await say('Not sent', status === 404 || status === 403
      ? "You can't reply to this conversation from your account."
      : 'Stride could not save your reply. Try again, or reply in Stride.'));
  }
  // Redraw the card without the reply box. If that fails (old card), confirm with a new message instead.
  const link = { label: 'Open Stride', url: ctx.appUrl };
  try {
    if (!activity.replyToId) throw new Error('no card to update');
    await ctx.connector.update(serviceUrl, conversationId, activity.replyToId, repliedCard(data, text, link));
  } catch {
    await say('Reply sent', `Posted to the team thread: ${text}`);
  }
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

  if (activity.type === 'message' && activity.conversation && activity.from && isReply(activity.value)) {
    await handleReply(activity, activity.value, ctx, serviceUrl);
    return;
  }

  if (activity.type === 'message' && activity.conversation && activity.from) {
    if (personal) {
      const member = await ctx.connector.getMember(serviceUrl, activity.conversation.id, activity.from.id);
      await save(ctx, contactFrom(member, serviceUrl, tenantId, now, activity.conversation.id));
    }
    await ctx.connector.send(serviceUrl, activity.conversation.id, noticeCard({
      title: 'Stride',
      text: "I send Stride notifications: reminders, actions for line managers, check-in requests and team thread messages. To answer a message, type in the reply box on its card and press Reply. To see progress, open Stride.",
      link: { label: 'Open Stride', url: ctx.appUrl },
    }));
  }
}
