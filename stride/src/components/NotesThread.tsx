import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Note } from '../api';

type Viewer = Note['from']; // 'starter' | 'manager' | 'buddy'

type Props = {
  notes: Note[];
  onSend: (text: string) => Promise<void>;
  viewer: Viewer; // whose messages show on the right, as "you"
  title?: string;
  placeholder?: string;
};

const ROLE: Record<Viewer, string> = { starter: 'New colleague', manager: 'Line manager', buddy: 'Buddy' };

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

// One team chat per new colleague, shared with their line manager and buddy (and sent to Teams).
// Messages read like a chat app: yours on the right, others on the left with their name and role.
export function NotesThread({ notes, onSend, viewer, title, placeholder = 'Write a message' }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [notes.length]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setError(null);
    setSending(true);
    try {
      await onSend(text);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Not sent');
    } finally {
      setSending(false);
    }
  };

  // Enter sends; Shift+Enter adds a new line.
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  let lastDay = '';
  return (
    <section className="chat">
      {title && <h3 className="chat-title">{title}</h3>}
      <div className="chat-messages" role="log" aria-live="polite" aria-label="Messages">
        {notes.length === 0 && <p className="chat-empty">No messages yet. Say hello 👋</p>}
        {notes.map((n) => {
          const day = dayLabel(n.sentAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = n.from === viewer;
          return (
            <div key={n.id}>
              {showDay && <p className="chat-day">{day}</p>}
              <div className={`bubble-row ${mine ? 'mine' : 'theirs'}`}>
                <div className={`bubble bubble-${n.from}`}>
                  {!mine && <span className="bubble-who">{n.fromName} · {ROLE[n.from]}</span>}
                  <span className="bubble-text">{n.text}</span>
                  <time className="bubble-time" dateTime={n.sentAt}>{time(n.sentAt)}</time>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {error && <p className="signin-error" role="alert">{error}</p>}
      <form onSubmit={send} className="chat-compose">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          maxLength={2000}
          rows={1}
          aria-label="Message"
        />
        <button type="submit" className="chat-send" disabled={sending || !text.trim()} aria-label="Send">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3 20.5v-7l9-1.5-9-1.5v-7L22 12z" /></svg>
        </button>
      </form>
    </section>
  );
}
