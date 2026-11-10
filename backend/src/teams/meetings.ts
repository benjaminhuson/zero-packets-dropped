// Section 3: check-in meetings.
//   graph: creates a Teams meeting in the line manager's calendar with Microsoft Graph (application permission
//          Calendars.ReadWrite on the teamNN-stride app, admin consent needed). The app signs in with a federated
//          credential that trusts the bot's managed identity, so there is still no secret.
//   link:  no permissions: a Teams "new meeting" link, pre-filled, for the manager to send themselves.
// Invites go only to accounts inside the tenant (hackathon rule: no email outside it).
import { ClientAssertionCredential, ManagedIdentityCredential, type TokenCredential } from '@azure/identity';

export interface MeetingRequest {
  organiserUpn: string; // the line manager
  attendeeUpns: string[]; // tenant accounts only (the linked colleague, if any)
  date: string; // YYYY-MM-DD
  time: string; // HH:MM, UK time
  minutes: number;
  subject: string;
  body: string;
}

// Teams deep link to a pre-filled new meeting. Times are UK local; Teams reads them as the user's time zone.
export function scheduleLink(req: MeetingRequest): string {
  const start = `${req.date}T${req.time}:00`;
  const end = addMinutes(req.date, req.time, req.minutes);
  const q = new URLSearchParams({ subject: req.subject, startTime: start, endTime: end, content: req.body });
  if (req.attendeeUpns.length) q.set('attendees', req.attendeeUpns.join(','));
  return `https://teams.microsoft.com/l/meeting/new?${q.toString()}`;
}

function addMinutes(date: string, time: string, minutes: number): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, h, mi + minutes));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:00`;
}

export class GraphMeetings {
  private readonly credential: TokenCredential;

  constructor(tenantId: string, entraClientId: string, managedIdentityClientId: string) {
    const mi = new ManagedIdentityCredential({ clientId: managedIdentityClientId });
    this.credential = new ClientAssertionCredential(tenantId, entraClientId, async () => {
      const t = await mi.getToken('api://AzureADTokenExchange/.default');
      if (!t) throw new Error('managed identity token unavailable');
      return t.token;
    });
  }

  async create(req: MeetingRequest): Promise<string | null> {
    const token = await this.credential.getToken('https://graph.microsoft.com/.default');
    if (!token) throw new Error('could not get a Graph token');
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(req.organiserUpn)}/events`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: req.subject,
        body: { contentType: 'text', content: req.body },
        start: { dateTime: `${req.date}T${req.time}:00`, timeZone: 'Europe/London' },
        end: { dateTime: addMinutes(req.date, req.time, req.minutes), timeZone: 'Europe/London' },
        attendees: req.attendeeUpns.map((a) => ({ emailAddress: { address: a }, type: 'required' })),
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness',
      }),
    });
    if (!res.ok) throw new Error(`Graph create event failed: ${res.status} ${await res.text().catch(() => '')}`);
    const event = (await res.json()) as { onlineMeeting?: { joinUrl?: string } };
    return event.onlineMeeting?.joinUrl ?? null;
  }
}
