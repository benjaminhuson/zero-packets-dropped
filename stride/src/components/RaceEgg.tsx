import { useEffect, useRef, useState } from 'react';
import { Horse } from './Horse';

// A hidden mini game: press space to gallop, beat the rival to the finish. Esc closes it.
type Props = { onClose: () => void };

const FINISH = 100;

export function RaceEgg({ onClose }: Props) {
  const [you, setYou] = useState(0);
  const [rival, setRival] = useState(0);
  const [status, setStatus] = useState<'ready' | 'racing' | 'won' | 'lost'>('ready');
  const [best, setBest] = useState<number>(() => Number(localStorage.getItem('stride-race-best') ?? '0'));
  const youRef = useRef(0);
  const rivalRef = useRef(0);
  const statusRef = useRef<typeof status>('ready');

  const finish = (winner: 'you' | 'rival') => {
    statusRef.current = winner === 'you' ? 'won' : 'lost';
    setStatus(statusRef.current);
    if (winner === 'you') {
      const seconds = raceClock.current ? (performance.now() - raceClock.current) / 1000 : 0;
      setBest((b) => {
        const next = b === 0 || seconds < b ? Math.round(seconds * 10) / 10 : b;
        localStorage.setItem('stride-race-best', String(next));
        return next;
      });
    }
  };
  const raceClock = useRef<number | null>(null);

  const reset = () => {
    youRef.current = 0;
    rivalRef.current = 0;
    setYou(0);
    setRival(0);
    raceClock.current = null;
    statusRef.current = 'ready';
    setStatus('ready');
  };

  // The rival gallops on its own once the race has started
  useEffect(() => {
    const t = window.setInterval(() => {
      if (statusRef.current !== 'racing') return;
      rivalRef.current = Math.min(FINISH, rivalRef.current + 0.5 + Math.random() * 1.1);
      setRival(rivalRef.current);
      if (rivalRef.current >= FINISH) finish('rival');
    }, 120);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Space gallops your horse; Esc closes the game
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.code !== 'Space' && e.key !== ' ') return;
      e.preventDefault();
      if (statusRef.current === 'won' || statusRef.current === 'lost') return;
      if (statusRef.current === 'ready') {
        statusRef.current = 'racing';
        setStatus('racing');
        raceClock.current = performance.now();
      }
      youRef.current = Math.min(FINISH, youRef.current + 3.2);
      setYou(youRef.current);
      if (youRef.current >= FINISH) finish('you');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const message =
    status === 'ready' ? 'Press space to start galloping!' :
    status === 'racing' ? 'Keep pressing space!' :
    status === 'won' ? 'You won the race!' : 'The rival got there first. Try again.';

  return (
    <div className="race-wrap" role="dialog" aria-modal="true" aria-label="Horse race mini game">
      <button className="drawer-scrim" aria-label="Close the race" onClick={onClose} />
      <section className="race-card">
        <header className="race-head">
          <p className="eyebrow">Cancara’s race</p>
          <button className="btn ghost" onClick={onClose}>Close (Esc)</button>
        </header>
        <p className="race-message">{message}</p>
        <div className="race-lanes">
          <div className="race-lane">
            <span className="race-name">You</span>
            <div className="race-track">
              <div className="race-horse" style={{ left: `${you}%` }}><Horse size={44} /></div>
              <span className="race-finish" aria-hidden="true" />
            </div>
          </div>
          <div className="race-lane">
            <span className="race-name">Rival</span>
            <div className="race-track rival">
              <div className="race-horse" style={{ left: `${rival}%`, filter: 'hue-rotate(160deg)' }}><Horse size={44} /></div>
              <span className="race-finish" aria-hidden="true" />
            </div>
          </div>
        </div>
        <footer className="race-foot">
          <span className="fine">Best time: {best ? `${best}s` : 'not set yet'}</span>
          {(status === 'won' || status === 'lost') && (
            <button className="btn primary" onClick={reset}>Race again</button>
          )}
        </footer>
      </section>
    </div>
  );
}
