// Section 3: Teams message layout. One simple Adaptive Card with a title, text and an optional button.
import type { TeamsNotice } from '../../contracts.js';
import type { Activity } from './connector.js';

// What a card's Reply button sends back to the bot (Teams adds the typed text as `reply`).
export interface ReplyData {
  stride: 'reply';
  starterId: string;
  quote?: string;
  original: string; // the card's text, so the card can be redrawn after replying
  title: string;
  reply?: string;
}

const card = (body: unknown[], actions: unknown[]) => ({
  contentType: 'application/vnd.microsoft.card.adaptive',
  content: {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body,
    actions,
  },
});

export function noticeCard(notice: TeamsNotice): Partial<Activity> {
  const body: unknown[] = [
    { type: 'TextBlock', text: notice.title, weight: 'Bolder', size: 'Medium', wrap: true },
    { type: 'TextBlock', text: notice.text, wrap: true },
  ];
  const actions: unknown[] = [];
  if (notice.reply) {
    body.push({ type: 'Input.Text', id: 'reply', placeholder: notice.reply.placeholder, isMultiline: true, maxLength: 2000 });
    const data: ReplyData = {
      stride: 'reply',
      starterId: notice.reply.starterId,
      quote: notice.reply.quote?.slice(0, 200),
      original: notice.text.slice(0, 500),
      title: notice.title.slice(0, 120),
    };
    actions.push({ type: 'Action.Submit', title: 'Reply', data });
  }
  if (notice.link) actions.push({ type: 'Action.OpenUrl', title: notice.link.label, url: notice.link.url });
  return {
    text: `${notice.title}: ${notice.text}`, // shown in notifications and by clients without card support
    attachments: [card(body, actions)],
  };
}

// The card after a reply: the original message, what was sent, and no reply box (so it can't be sent twice).
export function repliedCard(data: ReplyData, replyText: string, link?: { label: string; url: string }): Partial<Activity> {
  return {
    text: `${data.title}: ${data.original}`,
    attachments: [card(
      [
        { type: 'TextBlock', text: data.title, weight: 'Bolder', size: 'Medium', wrap: true },
        { type: 'TextBlock', text: data.original, wrap: true },
        { type: 'TextBlock', text: `You replied: ${replyText}`, wrap: true, color: 'Good', separator: true },
      ],
      link ? [{ type: 'Action.OpenUrl', title: link.label, url: link.url }] : [],
    )],
  };
}
