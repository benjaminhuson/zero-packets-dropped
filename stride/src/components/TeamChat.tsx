import { useCallback, useEffect, useState } from 'react';
import { NotesThread } from './NotesThread';
import { api, type Me, type Note } from '../api';

type Props = { me: Extract<Me, { kind: 'starter' }> };

const SEEN_KEY = (id: string) => `stride-chat-seen:${id}`;

function readSeen(id: string): string {
  try { return localStorage.getItem(SEEN_KEY(id)) ?? ''; } catch { return ''; }
}
function writeSeen(id: string, iso: string) {
  try { localStorage.setItem(SEEN_KEY(id), iso); } catch { /* storage blocked: the badge just resets */ }
}

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// The new colleague's team chat: a floating button (bottom left; Cancara is bottom right) that opens a chat
// with their line manager and buddy. Shows a badge for messages they haven't seen. Checks every 20 seconds,
// so replies sent from Teams appear on their own.
export function TeamChat({ me }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => readSeen(me.id));

  const load = useCallback(() => { void api.notes().then(setNotes).catch(() => undefined); }, []);
  useEffect(() => { load(); const t = window.setInterval(load, 20_000); return () => window.clearInterval(t); }, [load]);

  // Opening the chat marks everything as seen.
  const latest = notes.length ? notes[notes.length - 1].sentAt : '';
  useEffect(() => {
    if (open && latest && latest > seen) { setSeen(latest); writeSeen(me.id, latest); }
  }, [open, latest, seen, me.id]);
  useEffect(() => {
    if (!open) return;
    const close = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  const unread = notes.filter((n) => n.from !== 'starter' && n.sentAt > seen).length;
  const people = [me.manager && { ...me.manager, role: 'Line manager' }, me.buddy && { ...me.buddy, role: 'Buddy' }].filter(
    (p): p is { name: string; upn: string; role: string } => !!p,
  );

  return (
    <>
      <button
        className={`team-fab${unread ? ' has-unread' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={unread ? `Team chat, ${unread} new message${unread > 1 ? 's' : ''}` : 'Team chat'}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z" />
        </svg>
        <span className="team-fab-label">Team chat</span>
        {unread > 0 && <span className="team-fab-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="team-chat" role="dialog" aria-label="Team chat with your line manager and buddy">
          <header className="team-chat-head">
            <div className="team-chat-people">
              {people.map((p) => (
                <span key={p.upn} className="avatar" title={`${p.name}, ${p.role}`}>{initials(p.name)}</span>
              ))}
            </div>
            <div className="team-chat-names">
              <strong>Your team</strong>
              <span>{people.length ? people.map((p) => `${p.name} (${p.role.toLowerCase()})`).join(' · ') : 'Your line manager'}</span>
            </div>
            <button className="team-chat-close" onClick={() => setOpen(false)} aria-label="Close team chat">×</button>
          </header>
          <NotesThread
            viewer="starter"
            notes={notes}
            placeholder="Message your manager and buddy"
            onSend={async (t) => { await api.postNote(t); load(); }}
          />
          <p className="team-chat-foot">Your manager and buddy also get your messages in Microsoft Teams.</p>
        </div>
      )}
    </>
  );
}
