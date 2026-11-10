import { Horse } from './Horse';
import { BUDDY, LINE_MANAGER } from '../data';

type Props = { firstName: string; onContinue: () => void };

const HOW_IT_WORKS = [
  'Your journey has six stages, from accepting your offer to your first day.',
  'Each stage opens when the one before it is complete. We will tell you when that happens.',
  'Cancara, your AI buddy, guides you through every stage. Find Cancara at the bottom right of the screen.',
  'Your line manager only sees what you choose to share, and they hear from us through Teams.',
];

// Shown once, on the first visit after registering.
export function Welcome({ firstName, onContinue }: Props) {
  return (
    <main className="welcome-screen">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <div className="welcome-horse">
          <Horse size={96} />
        </div>
        <p className="eyebrow welcome-eyebrow">Lloyds Bank</p>
        <h1 id="welcome-title">Welcome to Lloyds Bank, {firstName}.</h1>
        <p className="welcome-lead">
          We are really glad you are here. Stride is your path to day one.
        </p>
        <p className="welcome-lead">
          Your manager is <strong>{LINE_MANAGER.name}</strong> and your buddy is <strong>{BUDDY.name}</strong>.
        </p>
        <p className="eyebrow welcome-eyebrow">How Stride works</p>
        <ul className="welcome-points">
          {HOW_IT_WORKS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <button className="btn primary welcome-cta" onClick={onContinue}>
          Let’s get started
        </button>
      </section>
    </main>
  );
}
