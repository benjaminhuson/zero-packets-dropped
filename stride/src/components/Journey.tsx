import { useEffect, useRef, useState } from 'react';
import { CHECKPOINTS, CHECKLIST, NEW_STARTER_ROLE } from '../data';
import { furthestUnlocked, type JourneyState } from '../store';
import { Horse } from './Horse';
import { OrgChart } from './OrgChart';

type Props = {
  state: JourneyState;
  doneCount: number;
  onGoTo: (index: number) => void;
  onComplete: () => void;
  onOpenChecklist: () => void;
};

// Timeline nodes: the offer day, then every checkpoint in order.
const NODES = [{ id: 'offer', title: 'Offer day' }, ...CHECKPOINTS.map((c) => ({ id: c.id, title: c.title }))];

export function Journey({ state, doneCount, onGoTo, onComplete, onOpenChecklist }: Props) {
  const checkpoint = CHECKPOINTS[state.current];
  const unlocked = furthestUnlocked(state.completed);
  const isLast = state.current === CHECKPOINTS.length - 1;
  const alreadyDone = state.completed.includes(checkpoint.id);
  // Horse sits on the node for the checkpoint being viewed (offset by 1 for the offer day node)
  const horseIndex = state.current + 1;
  // Each node sits in an equal column, so its centre is at (i + 0.5) / N of the track width
  const progressPct = ((horseIndex + 0.5) / NODES.length) * 100;

  // Walk the horse along the track whenever the current step changes.
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<1 | -1>(1);
  const lastIndex = useRef(horseIndex);
  useEffect(() => {
    if (lastIndex.current === horseIndex) return;
    setFacing(horseIndex > lastIndex.current ? 1 : -1);
    lastIndex.current = horseIndex;
    setWalking(true);
    const t = window.setTimeout(() => setWalking(false), 1100);
    return () => window.clearTimeout(t);
  }, [horseIndex]);

  return (
    <main className="journey">
      <header className="topbar">
        <div className="brand">
          <Horse size={32} />
          <div>
            <p className="eyebrow">Stride</p>
            <p className="brand-sub">Hi {state.firstName}, your first 90 days</p>
          </div>
        </div>
        <button className="btn outline" onClick={onOpenChecklist}>
          Checklist <span className="count">{doneCount}/{CHECKLIST.length}</span>
        </button>
      </header>

      <article className="checkpoint" key={checkpoint.id}>
        <p className="kicker">{checkpoint.kicker}</p>
        <h1>{checkpoint.title}</h1>

        {checkpoint.kind === 'cancara' && (
          <div className="hero-horse">
            <Horse size={120} />
          </div>
        )}

        {checkpoint.body.map((para) => (
          <p key={para} className="body">
            {para}
          </p>
        ))}

        {checkpoint.kind === 'role' && (
          <dl className="role-card">
            <div>
              <dt>Role</dt>
              <dd>{NEW_STARTER_ROLE.title}</dd>
            </div>
            <div>
              <dt>Team</dt>
              <dd>{NEW_STARTER_ROLE.team}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{NEW_STARTER_ROLE.location}</dd>
            </div>
          </dl>
        )}

        {checkpoint.highlights && (
          <ul className="highlights">
            {checkpoint.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}

        {checkpoint.kind === 'orgchart' && <OrgChart />}

        {checkpoint.checklistIds && checkpoint.checklistIds.length > 0 && (
          <p className="fine">
            Tasks for this checkpoint are in your checklist.
          </p>
        )}
      </article>

      <footer className="actions">
        <button
          className="btn ghost"
          onClick={() => onGoTo(state.current - 1)}
          disabled={state.current === 0}
        >
          Back
        </button>
        {isLast && alreadyDone ? (
          <p className="ok">You have reached Day 90. Well done.</p>
        ) : (
          <button className="btn primary" onClick={onComplete}>
            {isLast ? 'Finish my journey' : alreadyDone ? 'Next' : 'Mark complete and continue'}
          </button>
        )}
      </footer>

      <nav className="timeline" aria-label="Journey timeline">
        <div className="timeline-inner">
        <div className="track">
          <div className="track-fill" style={{ width: `${progressPct}%` }} />
          <div
            className={`horse-marker${walking ? ' walking' : ''}`}
            style={{ left: `${progressPct}%` }}
            aria-label={`You are here: ${checkpoint.title}`}
          >
            <span className="horse-body">
              <span className="horse-flip" style={{ transform: `scaleX(${facing})` }}>
                <Horse size={36} />
              </span>
            </span>
          </div>
        </div>
        <ol className="nodes" style={{ gridTemplateColumns: `repeat(${NODES.length}, 1fr)` }}>
          {NODES.map((node, i) => {
            const cpIndex = i - 1;
            const isDone = i === 0 || state.completed.includes(node.id);
            const reachable = cpIndex <= unlocked;
            const isCurrent = i === horseIndex;
            const cls = ['node', isDone ? 'done' : '', isCurrent ? 'current' : '', !reachable ? 'locked' : '']
              .filter(Boolean)
              .join(' ');
            return (
              <li key={node.id}>
                <button
                  className={cls}
                  disabled={!reachable || i === 0}
                  onClick={() => onGoTo(cpIndex)}
                  aria-current={isCurrent ? 'step' : undefined}
                  title={node.title}
                >
                  <span className="dot" aria-hidden="true">
                    {isDone && !isCurrent ? '✓' : ''}
                  </span>
                  <span className="node-label">{node.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
        </div>
      </nav>
    </main>
  );
}
