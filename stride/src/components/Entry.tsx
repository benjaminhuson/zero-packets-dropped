import { useState, type FormEvent } from 'react';
import { Horse } from './Horse';
import { NEW_STARTER_ROLE, LINE_MANAGER } from '../data';

type Props = { onRegister: (firstName: string) => void };

// Stand-in for the QR pattern on the invite card. Purely decorative in this prototype.
function QrPlaceholder() {
  const cells = Array.from({ length: 81 }, (_, i) => {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const corner = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
    const on = corner ? (r % 2 === 0 || c % 2 === 0) : ((r * 7 + c * 13 + i) % 3 === 0);
    return on ? i : -1;
  }).filter((i) => i >= 0);
  return (
    <svg className="qr" viewBox="0 0 9 9" role="img" aria-label="Invite QR code (placeholder)">
      <rect width="9" height="9" fill="#ffffff" />
      {cells.map((i) => (
        <rect key={i} x={i % 9} y={Math.floor(i / 9)} width="1" height="1" fill="#000000" />
      ))}
    </svg>
  );
}

export function Entry({ onRegister }: Props) {
  const [name, setName] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onRegister(name);
  };

  return (
    <main className="entry">
      <section className="entry-card">
        <div className="entry-brand">
          <Horse size={44} />
          <div>
            <p className="eyebrow">Lloyds · Stride</p>
            <h1>Welcome to Stride</h1>
          </div>
        </div>

        <p className="lead">
          You have accepted an offer for <strong>{NEW_STARTER_ROLE.title}</strong> in{' '}
          <strong>{NEW_STARTER_ROLE.team}</strong>. Stride guides you through your first 90 days, one week at a time,
          with your line manager able to see where you are.
        </p>

        <div className="entry-grid">
          <div className="invite">
            <QrPlaceholder />
            <p>Scan this code on your phone, or open the invite link from your email.</p>
          </div>

          <form className="register" onSubmit={submit}>
            <label htmlFor="firstName">What should we call you?</label>
            <input
              id="firstName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your first name"
              autoComplete="given-name"
              required
            />
            <button type="submit" className="btn primary">
              Start my journey
            </button>
            <p className="fine">
              When you register, {LINE_MANAGER.name} is notified in Microsoft Teams so they can get ready
              to welcome you.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
