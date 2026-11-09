import { useEffect, useRef, useState } from 'react';
import { CHECKLIST, LBG_VALUES, NEW_STARTER_ROLE, PAGES, TIMELINE } from '../data';
import { furthestUnlocked, type JourneyState } from '../store';
import { Horse } from './Horse';
import { OrgChart } from './OrgChart';
import { TeamsPanel } from './TeamsPanel';

type Props = {
  state: JourneyState;
  daysAway: number;
  onGoTo: (index: number) => void;
  onComplete: () => void;
  onOpenChecklist: () => void;
  onToggleTask: (id: string) => void;
  onShare: () => void;
  onRequestCheckIn: (req: { date: string; time: string; topic: string }) => void;
};

const TOTAL_WEEKS = 13;

export function Journey({ state, daysAway, onGoTo, onComplete, onOpenChecklist, onToggleTask, onShare, onRequestCheckIn }: Props) {
  const page = PAGES[state.current];
  const unlocked = furthestUnlocked(state.completed);
  const isLastPage = state.current === PAGES.length - 1;
  const alreadyDone = state.completed.includes(page.id);

  // The horse sits on the timeline node for the week being viewed. Node index = week number.
  const horseIndex = page.week;
  const progressPct = ((horseIndex + 0.5) / TIMELINE.length) * 100;
  const weekLabel = page.week === 0 ? 'Offer day' : `Week ${page.week} of ${TOTAL_WEEKS}`;

  const weekPageIndexes = PAGES.map((_, i) => i).filter((i) => PAGES[i].week === page.week);
  const pageInWeek = weekPageIndexes.indexOf(state.current) + 1;

  // Walk the horse along the track whenever the week changes.
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

  const [bannerOpen, setBannerOpen] = useState(daysAway > 0);
  const groupName = page.week === 0 ? 'Offer day' : `Week ${page.week}`;
  const tasksThisWeek = CHECKLIST.filter((c) => c.group === groupName);
  const tasksDone = tasksThisWeek.filter((c) => state.ticked.includes(c.id)).length;

  return (
    <div className="shell">
      <div className="stripe" aria-hidden="true" />
      <header className="app-header">
        <div className="brand">
          <Horse size={40} />
          <div>
            <p className="brand-name">Stride</p>
            <p className="brand-sub">Your first 90 days at Lloyds</p>
          </div>
        </div>
        <div className="header-right">
          <span className="hello">Hi {state.firstName}</span>
          <button className="btn header-btn" onClick={onOpenChecklist}>
            Checklist <span className="count">{state.ticked.length}/{CHECKLIST.length}</span>
          </button>
        </div>
      </header>

      <div className="layout">
        <main className="main">
          {daysAway > 0 && bannerOpen && (
            <div className="welcome-back" role="status">
              <p>
                <strong>Welcome back, {state.firstName}.</strong> It has been {daysAway}{' '}
                {daysAway === 1 ? 'day' : 'days'} since your last visit. You are in {weekLabel.toLowerCase()}.
              </p>
              <button className="btn ghost" onClick={() => setBannerOpen(false)}>
                Dismiss
              </button>
            </div>
          )}

          <div className="week-bar">
            <div>
              <p className="eyebrow">{weekLabel}</p>
              <p className="week-sub">
                {page.week === 0
                  ? 'Before your first day'
                  : `Page ${pageInWeek} of ${weekPageIndexes.length} this week · ${tasksDone}/${tasksThisWeek.length} tasks done`}
              </p>
            </div>
            <div className="colour-dots" aria-hidden="true">
              {LBG_VALUES.map((v) => (
                <span key={v.id} style={{ background: v.colour }} />
              ))}
            </div>
          </div>

          <article className="checkpoint" key={page.id}>
            <p className="kicker">{page.kicker}</p>
            <h1>{page.title}</h1>

            {page.kind === 'cancara' && (
              <div className="hero-horse">
                <Horse size={120} />
              </div>
            )}

            {page.body.map((para) => (
              <p key={para} className="body">
                {para}
              </p>
            ))}

            {page.kind === 'role' && (
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

            {page.highlights && (
              <ul className="highlights">
                {page.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}

            {page.kind === 'values' && (
              <>
                <img
                  className="values-poster"
                  src="/lbg-values.png"
                  alt="The five LBG values: People-first, Bold, Inclusive, Sustainable and Trust"
                />
                <div className="values-grid">
                  {LBG_VALUES.map((v) => (
                    <article key={v.id} className="value-card" style={{ borderTopColor: v.colour }}>
                      <h3>{v.name}</h3>
                      <p className="value-tagline">{v.tagline}</p>
                      <p className="value-behaviour">{v.behaviour}</p>
                      <p className="value-opposite">
                        <strong>The opposite is:</strong> {v.opposite}
                      </p>
                    </article>
                  ))}
                </div>
              </>
            )}

            {page.kind === 'team' && <OrgChart />}

            {page.tasks && page.tasks.length > 0 && (
              <div className="page-tasks">
                <p className="section-title">Tasks for this page</p>
                <ul>
                  {page.tasks.map((id) => {
                    const task = CHECKLIST.find((c) => c.id === id);
                    if (!task) return null;
                    const done = state.ticked.includes(id);
                    return (
                      <li key={id} className={done ? 'done' : undefined}>
                        <label className="task-row">
                          <input type="checkbox" checked={done} onChange={() => onToggleTask(id)} />
                          <span className="tick" aria-hidden="true">{done ? '✓' : ''}</span>
                          <span>{task.label}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </article>

          <footer className="actions">
            <button className="btn ghost" onClick={() => onGoTo(state.current - 1)} disabled={state.current === 0}>
              Back
            </button>
            {isLastPage && alreadyDone ? (
              <p className="ok">You have reached the end of your first 90 days.</p>
            ) : (
              <button className="btn primary" onClick={onComplete}>
                {isLastPage ? 'Finish' : alreadyDone ? 'Next' : 'Mark complete and continue'}
              </button>
            )}
          </footer>

          <nav className="timeline" aria-label="Week-by-week timeline">
            <div className="timeline-scroll">
              <div className="timeline-inner">
                <div className="track">
                  <div className="track-fill" style={{ width: `${progressPct}%` }} />
                  <div
                    className={`horse-marker${walking ? ' walking' : ''}`}
                    style={{ left: `${progressPct}%` }}
                    aria-label={`You are here: ${weekLabel}`}
                  >
                    <span className="horse-body">
                      <span className="horse-flip" style={{ transform: `scaleX(${facing})` }}>
                        <Horse size={34} />
                      </span>
                    </span>
                  </div>
                </div>
                <ol className="nodes" style={{ gridTemplateColumns: `repeat(${TIMELINE.length}, 1fr)` }}>
                  {TIMELINE.map((node, i) => {
                    const pagesInWeek = PAGES.filter((p) => p.week === node.week);
                    const weekDone = pagesInWeek.every((p) => state.completed.includes(p.id));
                    const reachable = node.firstPage <= unlocked;
                    const isCurrent = i === horseIndex;
                    const isFinish = i === TIMELINE.length - 1;
                    const cls = [
                      'node',
                      weekDone ? 'done' : '',
                      isCurrent ? 'current' : '',
                      !reachable ? 'locked' : '',
                      isFinish ? 'finish' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <li key={node.label}>
                        <button
                          className={cls}
                          disabled={!reachable}
                          onClick={() => onGoTo(node.firstPage)}
                          aria-current={isCurrent ? 'step' : undefined}
                          title={node.label}
                        >
                          <span className="dot" aria-hidden="true">
                            {weekDone && !isCurrent ? '✓' : ''}
                          </span>
                          <span className="node-label">{node.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </nav>
        </main>

        <aside className="side">
          <TeamsPanel state={state} weekLabel={weekLabel} onShare={onShare} onRequestCheckIn={onRequestCheckIn} />
          <section className="side-card">
            <p className="eyebrow">{groupName}</p>
            {tasksThisWeek.length === 0 ? (
              <p className="fine">No tasks this week.</p>
            ) : (
              <ul className="mini-tasks">
                {tasksThisWeek.map((t) => (
                  <li key={t.id} className={state.ticked.includes(t.id) ? 'done' : undefined}>
                    <label className="task-row">
                      <input type="checkbox" checked={state.ticked.includes(t.id)} onChange={() => onToggleTask(t.id)} />
                      <span className="tick" aria-hidden="true">{state.ticked.includes(t.id) ? '✓' : ''}</span>
                      <span>{t.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
