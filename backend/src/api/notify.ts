// Section 3: turns what happens in Stride into real Teams messages.
//
// The front end still runs the journey in the browser and raises its "Teams" messages there (stride/src/store.ts).
// When it saves its state, we compare with the last saved copy and deliver anything new:
//   teams[]    to-manager / to-starter messages      -> the manager / the colleague
//   checkIns[] check-in requests                     -> a Teams meeting (or a pre-filled meeting link) for the manager
// Only recent items are sent (so turning Teams on does not replay old history), and at most a few per save.
import type { Note, StarterAccount, TeamsGateway, TeamsNotice } from '../contracts.js';

const RECENT_MS = 10 * 60_000;
const MAX_PER_SAVE = 10;

interface ClientMessage {
  id: string;
  sentAt: string;
  direction: 'to-manager' | 'to-starter';
  kind: string;
  text: string;
}

interface ClientCheckIn {
  id: string;
  date: string;
  time: string;
  topic: string;
}

function list(state: unknown, key: string): Record<string, unknown>[] {
  const v = (state as Record<string, unknown> | null)?.[key];
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
}

function messages(state: unknown): ClientMessage[] {
  return list(state, 'teams').flatMap((m) =>
    typeof m.id === 'string' && typeof m.text === 'string' && typeof m.sentAt === 'string' && typeof m.kind === 'string' &&
    (m.direction === 'to-manager' || m.direction === 'to-starter')
      ? [{ id: m.id, sentAt: m.sentAt, direction: m.direction, kind: m.kind, text: m.text.slice(0, 500) }]
      : [],
  );
}

function checkIns(state: unknown): ClientCheckIn[] {
  return list(state, 'checkIns').flatMap((c) =>
    typeof c.id === 'string' && typeof c.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date) &&
    typeof c.time === 'string' && /^\d{2}:\d{2}$/.test(c.time)
      ? [{ id: c.id, date: c.date, time: c.time, topic: typeof c.topic === 'string' ? c.topic.slice(0, 200) : '' }]
      : [],
  );
}

const TITLES: Record<string, string> = {
  question: 'Question from your new colleague',
  action: 'Action needed',
  progress: 'Progress update',
  stage: 'New stage unlocked',
  reminder: 'Reminder',
  overdue: 'Overdue',
};

export async function deliverStateChanges(
  teams: TeamsGateway,
  account: StarterAccount | null,
  userId: string,
  previous: unknown,
  next: unknown,
  now: Date,
): Promise<number> {
  const name = account ? account.firstName : 'Your new colleague';
  const recent = (iso: string) => now.getTime() - Date.parse(iso) < RECENT_MS;
  let sent = 0;

  const seen = new Set(messages(previous).map((m) => m.id));
  for (const m of messages(next)) {
    if (sent >= MAX_PER_SAVE) break;
    if (seen.has(m.id) || !recent(m.sentAt) || m.kind === 'check-in') continue; // check-ins: handled below
    const notice: TeamsNotice = { title: TITLES[m.kind] ?? 'Stride', text: m.direction === 'to-manager' ? `${name}: ${m.text}` : m.text };
    // A question can be answered straight from Teams; the answer goes to the team thread.
    if (m.direction === 'to-manager' && m.kind === 'question') {
      notice.reply = { starterId: userId, placeholder: `Reply to ${name}`, quote: m.text };
    }
    if (m.direction === 'to-manager') await teams.sendToManager(userId, notice);
    else await teams.sendToStarter(userId, notice);
    sent++;
  }

  const seenCheckIns = new Set(checkIns(previous).map((c) => c.id));
  for (const c of checkIns(next)) {
    if (sent >= MAX_PER_SAVE) break;
    if (seenCheckIns.has(c.id)) continue;
    const topic = c.topic || 'Check-in';
    const meeting = await teams.createCheckInMeeting(userId, { date: c.date, time: c.time }, topic);
    const when = `${c.date} at ${c.time}`;
    if (meeting.joinUrl) {
      await teams.sendToManager(userId, { title: 'Check-in booked', text: `${name} asked for a check-in on ${when}: ${topic}. It is in your calendar.`, link: { label: 'Join meeting', url: meeting.joinUrl } });
      await teams.sendToStarter(userId, { title: 'Check-in booked', text: `Your check-in on ${when} is booked.`, link: { label: 'Join meeting', url: meeting.joinUrl } });
    } else {
      await teams.sendToManager(userId, {
        title: 'Check-in requested',
        text: `${name} asked for a check-in on ${when}: ${topic}.`,
        ...(meeting.scheduleUrl ? { link: { label: 'Schedule in Teams', url: meeting.scheduleUrl } } : {}),
      });
    }
    sent++;
  }
  return sent;
}

// Team thread: tell the other two people, with a reply box that posts back to the thread.
export async function deliverNote(teams: TeamsGateway, note: Note): Promise<void> {
  const notice: TeamsNotice = {
    title: `Team thread: ${note.fromName}`,
    text: note.text.slice(0, 500),
    reply: { starterId: note.starterId, placeholder: `Reply to ${note.fromName}` },
  };
  if (note.from !== 'starter') await teams.sendToStarter(note.starterId, notice);
  if (note.from !== 'manager') await teams.sendToManager(note.starterId, notice);
  if (note.from !== 'buddy') await teams.sendToBuddy(note.starterId, notice);
}
