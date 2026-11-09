import { CHECKLIST } from '../data';

type Props = {
  ticked: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
};

export function Checklist({ ticked, onToggle, onClose }: Props) {
  const phases = Array.from(new Set(CHECKLIST.map((c) => c.phase)));

  return (
    <div className="drawer-wrap" role="dialog" aria-modal="true" aria-label="Your checklist">
      <button className="drawer-scrim" aria-label="Close checklist" onClick={onClose} />
      <aside className="drawer">
        <header className="drawer-head">
          <div>
            <p className="eyebrow">Your checklist</p>
            <h2>
              {ticked.length} of {CHECKLIST.length} done
            </h2>
          </div>
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="progress" aria-hidden="true">
          <span style={{ width: `${(ticked.length / CHECKLIST.length) * 100}%` }} />
        </div>

        {phases.map((phase) => (
          <section key={phase} className="phase">
            <h3>{phase}</h3>
            <ul>
              {CHECKLIST.filter((c) => c.phase === phase).map((c) => {
                const checked = ticked.includes(c.id);
                return (
                  <li key={c.id}>
                    <label className={checked ? 'task done' : 'task'}>
                      <input type="checkbox" checked={checked} onChange={() => onToggle(c.id)} />
                      <span>{c.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </aside>
    </div>
  );
}
