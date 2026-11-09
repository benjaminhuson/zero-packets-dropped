import { useState, type FormEvent } from 'react';
import type { Note } from '../api';

type Props = {
  notes: Note[];
  onSend: (text: string) => Promise<void>;
  title?: string;
};

const WHO: Record<Note['from'], string> = { starter: 'New colleague', manager: 'Line manager', buddy: 'Buddy' };

// One thread per new colleague, shared with their line manager and buddy.
export function NotesThread({ notes, onSend, title = 'Team thread' }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    try {
      await onSend(text);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Not sent');
    }
  };

  return (
    <section className="thread">
      <h3>{title}</h3>
      {notes.length === 0 && <p className="fine">No messages yet. Say hello.</p>}
      <ul>
        {notes.map((n) => (
          <li key={n.id} className={`note note-${n.from}`}>
            <span className="note-who">{n.fromName} · {WHO[n.from]}</span>
            <span>{n.text}</span>
            <time dateTime={n.sentAt}>{new Date(n.sentAt).toLocaleString()}</time>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="thread-form">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" maxLength={2000} aria-label="Message" />
        <button type="submit" className="btn primary">Send</button>
      </form>
      {error && <p className="signin-error" role="alert">{error}</p>}
    </section>
  );
}
