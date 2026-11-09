import { useEffect, useRef, useState } from 'react';
import { LINE_MANAGER, NEW_STARTER_ROLE } from '../data';
import { APPROACHING_DAYS, STAGES, JOB_FAMILY, type Step } from '../stages';
import { hasStarted, unlockedStage, type Details, type Flow, type JourneyState } from '../store';
import { Horse } from './Horse';
import { ValuesExplorer } from './ValuesExplorer';
import { TeamsPanel } from './TeamsPanel';

export interface Actions {
  openStage: (n: number) => void;
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

function StepRow({ step, flow, actions }: { step: Step; flow: Flow; actions: Actions }) {
  const done = stepDone(step, flow);
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
              actions.requestCheckIn({ date: nextWorkingDate(), time: '10:00', topic });
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
  const stageIsUnlocked = state.viewStage <= unlocked;
  const started = hasStarted(f);
  const progressPct = ((unlocked + 0.5) / STAGES.length) * 100;

  // Walk the horse along the track when the user reaches a new stage.
  const [walking, setWalking] = useState(false);
  const lastStage = useRef(unlocked);
  useEffect(() => {
    if (lastStage.current === unlocked) return;
    lastStage.current = unlocked;
    setWalking(true);
    const t = window.setTimeout(() => setWalking(false), 1700);
    return () => window.clearTimeout(t);
  }, [unlocked]);

  const nextTrigger = unlocked < STAGES.length - 1 ? STAGES[unlocked].trigger : null;
  const triggerDone = (n: number) => n < unlocked;

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
          <nav className="timeline stage-track" aria-label="Your stages">
            <div className="timeline-scroll">
              <div className="timeline-inner">
                <div className="track">
                  <div className="track-fill" style={{ width: `${progressPct}%` }} />
                  <div className={`horse-marker${walking ? ' walking' : ''}`} style={{ left: `${progressPct}%` }} aria-label={`You are in stage ${unlocked}: ${STAGES[unlocked].name}`}>
                    <span className="marker-label">You are here</span>
                    <span className="horse-body">
                      <Horse size={46} />
                    </span>
                  </div>
                </div>
                <ol className="nodes" style={{ gridTemplateColumns: `repeat(${STAGES.length}, 1fr)` }}>
                  {STAGES.map((s) => {
                    const isUnlocked = s.id <= unlocked;
                    const cls = ['node', triggerDone(s.id) ? 'done' : '', s.id === state.viewStage ? 'current' : '', !isUnlocked ? 'locked' : ''].filter(Boolean).join(' ');
                    return (
                      <li key={s.id}>
                        <button className={cls} disabled={!isUnlocked} onClick={() => openStage(s.id)} aria-current={s.id === state.viewStage ? 'step' : undefined}>
                          <span className="dot" aria-hidden="true">{triggerDone(s.id) ? '✓' : ''}</span>
                          <span className="node-label">Stage {s.id}<br />{s.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </nav>

          <article className="checkpoint stage-card" key={viewed.id}>
            <p className="kicker">Stage {viewed.id} of {STAGES.length - 1}</p>
            <h1>{viewed.name}</h1>
            <p className="body">{viewed.summary}</p>

            {!stageIsUnlocked && (
              <p className="fine">This stage is locked until the previous trigger is met.</p>
            )}

            {stageIsUnlocked && viewed.id === 0 && (
              <div className="role-card-simple">
                <p className="eyebrow">Your role</p>
                <p><strong>{NEW_STARTER_ROLE.title}</strong>, {NEW_STARTER_ROLE.team}</p>
              </div>
            )}

            {stageIsUnlocked && (
              <ol className="steps">
                {viewed.steps.map((step) => (
                  <StepRow key={step.id} step={step} flow={f} actions={props} />
                ))}
              </ol>
            )}

            {viewed.id < STAGES.length - 1 && (
              <div className="trigger-banner">
                <p className="eyebrow">Next stage unlocks when</p>
                <p>{viewed.trigger}.</p>
                {viewed.id === 4 && <p className="fine">Stage 5 also opens {APPROACHING_DAYS} days before your start date.</p>}
              </div>
            )}

            {viewed.id === 5 && started && <p className="ok">You have started. Welcome to Lloyds.</p>}
          </article>

          <section className="demo-card" aria-label="Prototype controls">
            <p className="eyebrow">Prototype controls</p>
            <p className="fine">These stand in for Workday, Entra ID and IT. Replace them with real events.</p>
            <div className="demo-grid">
              <button className="btn outline" onClick={props.completeVetting} disabled={f.vettingComplete}>Workday: vetting complete</button>
              <button className="btn outline" onClick={props.managerConfirmDate} disabled={!f.starterAgreedDate || f.managerAgreedDate}>{MANAGER}: confirm start date</button>
              <button className="btn outline" onClick={() => props.managerSetUpn(`${state.firstName.toLowerCase() || 'new.starter'}@lloydsbanking.example`)} disabled={!!f.upn || unlocked < 4}>{MANAGER}: add UPN in Entra</button>
              <button className="btn outline" onClick={props.dispatchLaptop} disabled={f.laptopSent || unlocked < 4}>IT: dispatch laptop</button>
              <button className="btn outline" onClick={props.simulateApproaching} disabled={f.demoApproaching}>Start date is approaching</button>
              <button className="btn outline" onClick={props.simulateStarted} disabled={f.demoStarted}>Start date reached</button>
            </div>
          </section>

          {nextTrigger && <p className="fine">Trigger for the next stage: {nextTrigger}.</p>}
        </main>

        <aside className="side">
          <TeamsPanel state={state} stageLabel={`Stage ${unlocked}: ${STAGES[unlocked].name}`} onShare={props.shareProgress} onRequestCheckIn={props.requestCheckIn} />
        </aside>
      </div>
    </div>
  );
}
