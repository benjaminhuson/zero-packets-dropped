// Section 3: Teams message layout. One simple Adaptive Card with a title, text and an optional button.
import type { TeamsNotice } from '../../contracts.js';
import type { Activity } from './connector.js';

export function noticeCard(notice: TeamsNotice): Partial<Activity> {
  return {
    text: `${notice.title}: ${notice.text}`, // shown in notifications and by clients without card support
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.4',
          body: [
            { type: 'TextBlock', text: notice.title, weight: 'Bolder', size: 'Medium', wrap: true },
            { type: 'TextBlock', text: notice.text, wrap: true },
          ],
          actions: notice.link ? [{ type: 'Action.OpenUrl', title: notice.link.label, url: notice.link.url }] : [],
        },
      },
    ],
  };
}
