import { useEffect, useRef, useState } from 'react';
import { LINE_MANAGER, NEW_STARTER_ROLE } from '../data';
import { APPROACHING_DAYS, STAGES, JOB_FAMILY, type Step } from '../stages';
import { hasStarted, unlockedStage, type Details, type Flow, type JourneyState } from '../store';
import { Horse } from './Horse';
import { freeSlots, type Slot } from '../calendar';
import { ValuesExplorer } from './ValuesExplorer';

export interface Actions {
  openStage: (n: number) => void;
  dismissCelebrate: () => void;
  toggleStep: (id: string) => void;
  saveDetails: (d: Details) => void;
  setDevice: (d: 'mac' | 'windows') => void;
  uploadPhoto: (name: string) => void;
  confirmNotice: () => void;
  saveObjectives: (text: string) => void;
  saveContacts: (text: string) => void;
  agreeStartDate: (date: string) => void;
  managerConfirmDate: () => void;
  completeVetting: () => void;
  managerSetUpn: (upn: string) => void;
  dispatchLaptop: () => void;
  simulateApproaching: () => void;
  simulateStarted: () => void;
  shareProgress: () => void;
  requestCheckIn: (req: { date: string; time: string; topic: string }) => void;
  notifyManagerOfActions: () => void;
  promptCheckIn: (stage: number) => void;
  onOpenChat: () => void;
  bookCheckInFromChat: (stage: number, slot: Slot) => void;
}

interface Props extends Actions {
  state: JourneyState;
}

const MANAGER = LINE_MANAGER.name.split(' ')[0];

// A working day, `days` ahead of today, as YYYY-MM-DD
function nextWorkingDate(days = 1, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Default start date: about five weeks out, so the approaching trigger does not fire straight away
const DEFAULT_START_DAYS = 35;

// Is a step finished, as far as the starter can see?
function stepDone(step: Step, f: Flow): boolean {
  switch (step.id) {
    case 's0-accept': case 's0-account': case 's0-login': case 's0-manager': return f.accepted;
    case 's1-vetting': return f.vettingComplete;
    case 's1-details': return !!f.details;
    case 's2-startdate': return f.starterAgreedDate && f.managerAgreedDate;
    case 's3-device': return !!f.device;
    case 's3-photo': return !!f.photoName;
    case 's3-notice': return f.noticeConfirmed;
    case 's4-entra': return !!f.upn;
    case 's4-laptop': return f.laptopSent;
    case 's4-objectives': return f.objectives.trim().length > 0;
    case 's5-contacts': return f.emergencyContacts.trim().length > 0;
    default: return f.stepsDone.includes(step.id);
  }
}

function StepRow({ step, flow, actions, locked, prereqTitle }: { step: Step; flow: Flow; actions: Actions; locked: boolean; prereqTitle?: string }) {
  const done = stepDone(step, flow);
  if (locked) {
    return (
      <li className="step locked">
        <div className="step-head">
          <span className="step-mark" aria-hidden="true" />
          <div>
            <p className="step-title">{step.title}</p>
            <p className="step-owner">Opens after: {prereqTitle}</p>
          </div>
        </div>
      </li>
    );
  }
  const ownerLabel = step.owner === 'you' ? 'You' : step.owner === 'manager' ? MANAGER : 'Automatic';
  const [objectives, setObjectives] = useState(flow.objectives);
  const [contacts, setContacts] = useState(flow.emergencyContacts);
  const [details, setDetails] = useState<Details>(flow.details ?? { preferredName: '', mobile: '', personalEmail: '' });
  const [date, setDate] = useState(flow.startDate ?? nextWorkingDate(DEFAULT_START_DAYS));
  const [topic, setTopic] = useState('');

  let control: React.ReactNode = null;

  switch (step.kind) {
    case 'check':
    case 'link':
      control = (
        <label className="step-check">
          <input type="checkbox" checked={flow.stepsDone.includes(step.id)} onChange={() => actions.toggleStep(step.id)} />
          <span>{step.kind === 'link' ? 'Mark as read' : 'Done'}</span>
          {step.kind === 'link' && step.href && (
            <a className="step-link" href={step.href} onClick={(e) => e.preventDefault()}>
              Open
            </a>
          )}
        </label>
      );
      break;
    case 'details':
      control = (
        <form
          className="step-form"
          onSubmit={(e) => {
            e.preventDefault();
            actions.saveDetails(details);
          }}
        >
          <input placeholder="Preferred name" value={details.preferredName} onChange={(e) => setDetails({ ...details, preferredName: e.target.value })} required />
          <input placeholder="Mobile" value={details.mobile} onChange={(e) => setDetails({ ...details, mobile: e.target.value })} required />
          <input placeholder="Personal email" type="email" value={details.personalEmail} onChange={(e) => setDetails({ ...details, personalEmail: e.target.value })} required />
          <button className="btn primary" type="submit">Save details</button>
        </form>
      );
      break;
    case 'values':
      control = (
        <ValuesExplorer
          onAllViewed={() => {
            if (!flow.stepsDone.includes(step.id)) actions.toggleStep(step.id);
          }}
        />
      );
      break;
    case 'date':
      control = (
        <div className="step-form">
          <label className="inline-label">
            Proposed start date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button className="btn primary" onClick={() => actions.agreeStartDate(date)} disabled={!date}>
            Agree this date
          </button>
          {flow.starterAgreedDate && (
            <p className="status">
              {flow.managerAgreedDate ? `Agreed by you and ${MANAGER}.` : `Waiting for ${MANAGER} to confirm.`}
            </p>
          )}
        </div>
      );
      break;
    case 'meeting':
      control = (
        <div className="step-form">
          <input placeholder="What would you like to talk about?" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <button
            className="btn outline"
            onClick={() => {
              const slot = freeSlots(new Date(), { count: 1 })[0];
              if (slot) actions.requestCheckIn({ date: slot.date, time: slot.time, topic });
              setTopic('');
            }}
          >
            Ask {MANAGER} for a check-in
          </button>
          <p className="fine">{MANAGER} gets a one-click Teams meeting invite.</p>
        </div>
      );
      break;
    case 'device':
      control = (
        <div className="choice">
          {(['mac', 'windows'] as const).map((d) => (
            <button key={d} className={flow.device === d ? 'choice-btn on' : 'choice-btn'} onClick={() => actions.setDevice(d)} aria-pressed={flow.device === d}>
              {d === 'mac' ? 'Mac' : 'Windows'}
            </button>
          ))}
        </div>
      );
      break;
    case 'photo':
      control = (
        <div className="step-form">
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && actions.uploadPhoto(e.target.files[0].name)} />
          {flow.photoName && <p className="status">Uploaded: {flow.photoName}</p>}
        </div>
      );
      break;
    case 'objectives':
      control = (
        <textarea
          className="step-text"
          rows={3}
          placeholder="For example: deliver my first feature, and get my first code review done."
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          onBlur={() => actions.saveObjectives(objectives)}
        />
      );
      break;
    case 'contacts':
      control = (
        <textarea
          className="step-text"
          rows={2}
          placeholder="Name, relationship and phone number"
          value={contacts}
          onChange={(e) => setContacts(e.target.value)}
          onBlur={() => actions.saveContacts(contacts)}
        />
      );
      break;
    case 'upn':
      control = <p className="status">{flow.upn ? `Account set up: ${flow.upn}` : `Waiting for ${MANAGER} to add your UPN in Microsoft Entra ID.`}</p>;
      break;
    case 'laptop':
      control = <p className="status">{flow.laptopSent ? 'Dispatched. Your welcome pack is on its way.' : 'Waiting for IT to dispatch your laptop.'}</p>;
      break;
    case 'article':
      control = (
        <details className="article" open={step.openByDefault}>
          <summary>{step.title}</summary>
          {(step.paragraphs ?? []).map((para) => (
            <p key={para} className="article-text">{para}</p>
          ))}
          <label className="step-check">
            <input type="checkbox" checked={flow.stepsDone.includes(step.id)} onChange={() => actions.toggleStep(step.id)} />
            <span>Mark as read</span>
          </label>
        </details>
      );
      break;
    case 'auto':
    case 'info':
    default:
      control = null;
  }

  return (
    <li className={`step ${done ? 'done' : ''}`}>
      <div className="step-head">
        <span className="step-mark" aria-hidden="true">{done ? '✓' : ''}</span>
        <div>
          <p className="step-title">{step.title}</p>
          <p className="step-owner">{ownerLabel}</p>
        </div>
      </div>
      {step.body && <p className="step-body">{step.body}</p>}
      {control}
    </li>
  );
}

export function StageJourney(props: Props) {
  const { state, openStage } = props;
  const f = state.flow;
  const unlocked = unlockedStage(f);
  const viewed = STAGES[state.viewStage];
  const started = hasStarted(f);

  // Slides: one step per slide inside the stage on screen.
  const [slide, setSlide] = useState(0);
  const steps = viewed.steps;
  const current = steps[Math.min(slide, steps.length - 1)];
  const currentPrereq = current.after ? steps.find((x) => x.id === current.after) : undefined;
  const currentLocked = !!currentPrereq && !stepDone(currentPrereq, f);

  // The horse sits at stage + fraction through the stage's slides.
  const fraction = steps.length > 0 ? Math.min(slide, steps.length - 1) / steps.length : 0;
  const horsePos = state.viewStage + fraction;
  const progressPct = ((horsePos + 0.5) / STAGES.length) * 100;

  // Gallop whenever the horse moves: a new slide or a new stage.
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<1 | -1>(1);
  const lastPos = useRef(horsePos);
  useEffect(() => {
    if (lastPos.current === horsePos) return;
    setFacing(horsePos > lastPos.current ? 1 : -1);
    lastPos.current = horsePos;
    setWalking(true);
    const t = window.setTimeout(() => setWalking(false), 900);
    return () => window.clearTimeout(t);
  }, [horsePos]);

  // End of a stage: Cancara offers a check-in with the line manager (stages 1 to 4, once each)
  useEffect(() => {
    const atEnd = slide === steps.length - 1;
    const unlockedHere = state.viewStage <= unlocked;
    if (atEnd && unlockedHere && state.viewStage >= 1 && state.viewStage <= 4) props.promptCheckIn(state.viewStage);
  }, [slide, state.viewStage, unlocked]);

  const goStage = (n: number, atSlide: number) => {
    openStage(n);
    setSlide(atSlide);
  };

  // Next: next slide, or the first slide of the next stage if it is open.
  const canNext = slide < steps.length - 1 || (state.viewStage < STAGES.length - 1 && state.viewStage + 1 <= unlocked);
  const next = () => {
    if (slide < steps.length - 1) setSlide(slide + 1);
    else if (state.viewStage < STAGES.length - 1 && state.viewStage + 1 <= unlocked) goStage(state.viewStage + 1, 0);
  };
  // Back: previous slide, or the last slide of the previous stage.
  const canBack = slide > 0 || state.viewStage > 0;
  const back = () => {
    if (slide > 0) setSlide(slide - 1);
    else if (state.viewStage > 0) goStage(state.viewStage - 1, STAGES[state.viewStage - 1].steps.length - 1);
  };

  // Keyboard arrows move through the slides.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onNode = (n: number) => goStage(n, 0);

  // Cancara introduces itself with a speech bubble on the "Meet Cancara" step
  const onCancaraStep = current.id === 's1-cancara' && !currentLocked;
  const [bubbleHidden, setBubbleHidden] = useState(false);
  useEffect(() => {
    if (onCancaraStep) setBubbleHidden(false);
  }, [onCancaraStep]);
  const showBubble = onCancaraStep && !bubbleHidden;

  // Drag the bubble anywhere on screen. Position is remembered between visits.
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = localStorage.getItem('stride-bubble-pos');
      return raw ? (JSON.parse(raw) as { x: number; y: number }) : null;
    } catch {
      return null;
    }
  });
  const bubbleRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ dx: number; dy: number } | null>(null);
  const onDragStart = (e: React.PointerEvent) => {
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStart.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragStart.current || !bubbleRef.current) return;
    const { width, height } = bubbleRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - dragStart.current.dx), window.innerWidth - width);
    const y = Math.min(Math.max(0, e.clientY - dragStart.current.dy), window.innerHeight - height);
    setBubblePos({ x, y });
  };
  const onDragEnd = () => {
    if (!dragStart.current) return;
    dragStart.current = null;
    if (bubblePos) localStorage.setItem('stride-bubble-pos', JSON.stringify(bubblePos));
  };
  const stageDone = unlocked > state.viewStage;
  const nextStageName = state.viewStage < STAGES.length - 1 ? STAGES[state.viewStage + 1].name : null;

  return (
    <div className="shell">
      <header className="app-header">
        <div className="brand">
          <Horse size={40} />
          <div>
            <p className="brand-name">Stride</p>
            <p className="brand-sub">{JOB_FAMILY} · your path to day one</p>
          </div>
        </div>
        <div className="header-right">
          <span className="hello">Hi {state.firstName}</span>
        </div>
      </header>

      <div className="layout">
        <main className="main">
          {state.celebrate !== null && (
            <div className="celebrate" role="status">
              <div className="celebrate-text">
                <p className="eyebrow">Well done</p>
                <p className="celebrate-title">
                  Congratulations, {state.firstName}! You’ve completed {STAGES[state.celebrate - 1].name}.
                </p>
                <p className="fine">Stage {state.celebrate}, {STAGES[state.celebrate].name}, is now open.</p>
              </div>
              <button className="btn primary" onClick={props.dismissCelebrate}>Continue</button>
            </div>
          )}

          <nav className="timeline stage-track" aria-label="Your stages">
            <div className="timeline-scroll">
              <div className="timeline-inner">
                <div className="track">
                  <div className="track-fill" style={{ width: `${progressPct}%` }} />
                  <div className={`horse-marker${walking ? ' walking' : ''}`} style={{ left: `${progressPct}%` }} aria-label={`You are on ${viewed.name}, step ${Math.min(slide, steps.length - 1) + 1} of ${steps.length}`}>
                    <span className="marker-label">You are here</span>
                    <span className="horse-body">
                      <span className="horse-flip" style={{ transform: `scaleX(${facing})` }}>
                        <Horse size={46} />
                      </span>
                    </span>
                  </div>
                </div>
                <ol className="nodes" style={{ gridTemplateColumns: `repeat(${STAGES.length}, 1fr)` }}>
                  {STAGES.map((s) => {
                    const isUnlocked = s.id <= unlocked;
                    const isDone = s.id < unlocked;
                    const cls = ['node', isDone ? 'done' : '', s.id === state.viewStage ? 'current' : '', !isUnlocked ? 'locked' : ''].filter(Boolean).join(' ');
                    return (
                      <li key={s.id}>
                        <button className={cls} disabled={!isUnlocked} onClick={() => onNode(s.id)} aria-current={s.id === state.viewStage ? 'step' : undefined}>
                          <span className="dot" aria-hidden="true">{isDone ? '✓' : ''}</span>
                          <span className="node-label">Stage {s.id}<br />{s.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </nav>

          {showBubble && (
            <div
              ref={bubbleRef}
              className={`cancara-bubble${bubblePos ? ' moved' : ''}`}
              role="dialog"
              aria-label="Cancara introduction"
              style={bubblePos ? { left: bubblePos.x, top: bubblePos.y, right: 'auto', bottom: 'auto' } : undefined}
            >
              <div
                className="bubble-handle"
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
                aria-label="Drag to move Cancara’s message"
                role="separator"
              >
                <span aria-hidden="true">⠿ Drag to move</span>
              </div>
              <div className="cancara-bubble-body">
                <p className="eyebrow">Cancara</p>
                <p>Hi {state.firstName}, I’m Cancara, your AI buddy. I’ll guide you through every stage. Ask me anything, any time.</p>
                <div className="cancara-bubble-actions">
                  <button className="btn primary" onClick={() => { props.onOpenChat(); setBubbleHidden(true); }}>Say hello</button>
                  <button className="btn ghost" onClick={() => setBubbleHidden(true)}>Got it</button>
                </div>
              </div>
              {!bubblePos && <span className="cancara-bubble-tail" aria-hidden="true" />}
            </div>
          )}

          <article className="checkpoint stage-card" key={`${viewed.id}-${slide}`}>
            <div className="slide-head">
              <p className="kicker">Stage {viewed.id} of {STAGES.length - 1} · {viewed.name}</p>
              <p className="slide-count">Step {Math.min(slide, steps.length - 1) + 1} of {steps.length}</p>
            </div>
            <div className="slide-dots" role="tablist" aria-label="Steps in this stage">
              {steps.map((st, i) => (
                <button
                  key={st.id}
                  className={`slide-dot${i === slide ? ' on' : ''}${stepDone(st, f) ? ' done' : ''}`}
                  onClick={() => setSlide(i)}
                  aria-label={`Step ${i + 1}: ${st.title}`}
                  aria-selected={i === slide}
                  role="tab"
                />
              ))}
            </div>

            {state.viewStage <= unlocked ? (
              <ol className="steps slide">
                <StepRow key={current.id} step={current} flow={f} actions={props} locked={currentLocked} prereqTitle={currentPrereq?.title} />
              </ol>
            ) : (
              <p className="fine">This stage is locked until the previous trigger is met.</p>
            )}

            {viewed.id === 0 && slide === 0 && (
              <div className="role-card-simple">
                <p className="eyebrow">Your role</p>
                <p><strong>{NEW_STARTER_ROLE.title}</strong>, {NEW_STARTER_ROLE.team}</p>
              </div>
            )}

            {slide === steps.length - 1 && viewed.id < STAGES.length - 1 && (
              <div className="trigger-banner">
                <p className="eyebrow">Next stage unlocks when</p>
                <p>{viewed.trigger}.</p>
                {viewed.id === 4 && <p className="fine">Stage 5 also opens {APPROACHING_DAYS} days before your start date.</p>}
              </div>
            )}

            {viewed.id === 5 && started && slide === steps.length - 1 && <p className="ok">You have started. Welcome to Lloyds.</p>}
          </article>

          <div className="slide-nav">
            <button className="btn outline" onClick={back} disabled={!canBack} aria-label="Previous step">
              ← Back
            </button>
            <p className="fine slide-hint">Use the arrow keys or the buttons to move through the steps.</p>
            {canNext ? (
              <button className="btn primary" onClick={next} aria-label="Next step">
                {slide === steps.length - 1 && nextStageName ? `Next: ${nextStageName} →` : 'Next →'}
              </button>
            ) : (
              <button className="btn primary" disabled aria-label="Next step locked">
                {stageDone ? 'All done' : 'Locked'}
              </button>
            )}
          </div>

          <details className="stage-checklist" open>
            <summary>Your checklist</summary>
            {STAGES.map((st) => {
              const open = st.id <= unlocked;
              return (
                <div key={st.id} className={`cl-stage${open ? '' : ' cl-locked'}`}>
                  <p className="cl-title">
                    Stage {st.id}: {st.name}
                    {!open && <span className="cl-tag"> · locked</span>}
                  </p>
                  <ul>
                    {st.steps.map((step, i) => {
                      const done = stepDone(step, f);
                      return (
                        <li key={step.id}>
                          <button className="cl-row" disabled={!open} onClick={() => goStage(st.id, i)}>
                            <span className={`cl-box${done ? ' on' : ''}`} aria-hidden="true">{done ? '✓' : ''}</span>
                            <span className={done ? 'cl-text done' : 'cl-text'}>{step.title}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </details>

        </main>

      </div>
    </div>
  );
}
