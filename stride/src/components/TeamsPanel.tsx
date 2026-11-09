import { useState } from 'react';
import { CHECKLIST, LINE_MANAGER, NEW_STARTER_ROLE } from '../data';
import type { JourneyState, TeamsMessage } from '../store';

type Props = {
  state: JourneyState;
  weekLabel: string;
  onShare: () => void;
  onRequestCheckIn: (req: { date: string; time: string; topic: string }) => void;
};

const TIMES = ['10:00', '11:00', '14:00', '15:30'];
const MANAGER_FIRST = LINE_MANAGER.name.split(' ')[0];

const KIND_LABEL: Record<TeamsMessage['kind'], string> = {
  question: 'Question',
  action: 'Action',
  progress: 'Update',
  'check-in': 'Check-in',
  reminder: 'Reminder',
  overdue: 'Overdue',
};

// The next five working days, as YYYY-MM-DD with a readable label
function nextWorkingDays(from: Date, count: number) {
  const out: { value: string; label: string }[] = [];
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  while (out.length < count) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day === 0 || day === 6) continue;
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({ value, label: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) });
  }
  return out;
}

function Feed({ items, empty }: { items: TeamsMessage[]; empty: string }) {
  if (items.length === 0) return <p className="fine">{empty}</p>;
  return (
    <ul className="teams-list">
      {items.slice(0, 4).map((m) => (
        <li key={m.id}>
          <span className={`kind kind-${m.kind}`}>{KIND_LABEL[m.kind]}</span>
          <span>{m.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function TeamsPanel({ state, weekLabel, onShare, onRequestCheckIn }: Props) {
  const days = nextWorkingDays(new Date(), 5);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [date, setDate] = useState(days[0].value);
  const [time, setTime] = useState(TIMES[1]);
  const [topic, setTopic] = useState('');

  const lastShare = state.shares[0];
  const lastCheckIn = state.checkIns[0];
  const fromCancara = state.teams.filter((m) => m.direction === 'to-starter');
  const toManager = state.teams.filter((m) => m.direction === 'to-manager');

  // What the manager sees: the current week, its tasks done, and check-in requests. Nothing else.
  const currentWeekGroup = state.current === 0 ? 'Offer day' : weekLabel.split(' of ')[0];
  const weekTasks = CHECKLIST.filter((c) => c.group === currentWeekGroup);
  const weekDone = weekTasks.filter((c) => state.ticked.includes(c.id)).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onRequestCheckIn({ date, time, topic: topic.trim() || 'Check-in' });
    setShowForm(false);
    setTopic('');
  };

  return (
    <section className="teams-panel" aria-label="Microsoft Teams">
      <header className="teams-head">
        <img className="teams-logo" src="/teams-icon.svg" alt="" width={40} height={40} />
        <div>
          <p className="eyebrow">Microsoft Teams</p>
          <p className="teams-sub">Stride is connected to your Teams</p>
        </div>
      </header>

      <div className="manager-card">
        <div className="avatar" aria-hidden="true">
          {MANAGER_FIRST[0]}
          {LINE_MANAGER.name.split(' ')[1][0]}
        </div>
        <div>
          <p className="person-name">{LINE_MANAGER.name}</p>
          <p className="person-role">{LINE_MANAGER.role}</p>
        </div>
      </div>

      <p className="teams-status">
        {lastShare ? (
          <>
            Last update sent: <strong>{lastShare.pageTitle}</strong> (
            {new Date(lastShare.sentAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })})
          </>
        ) : (
          <>{MANAGER_FIRST} has not been sent an update yet.</>
        )}
      </p>

      <div className="teams-actions">
        <button className="btn primary block" onClick={onShare}>
          Share where I am ({weekLabel})
        </button>
        <button className="btn outline block" onClick={() => setShowForm((v) => !v)} aria-expanded={showForm}>
          Request a check-in
        </button>
        <button className="btn ghost block" onClick={() => setShowPreview((v) => !v)} aria-expanded={showPreview}>
          {showPreview ? 'Hide' : 'Preview'} what {MANAGER_FIRST} sees
        </button>
      </div>

      {showPreview && (
        <div className="manager-preview" aria-label={`What ${MANAGER_FIRST} sees`}>
          <p className="eyebrow">Shared with {MANAGER_FIRST}</p>
          <ul className="teams-list">
            <li>Current week: {weekLabel}</li>
            <li>
              Tasks done this week: {weekDone} of {weekTasks.length}
            </li>
            <li>Check-in requests: {state.checkIns.length}</li>
          </ul>
          <p className="fine">Not shared: personal notes and reflections.</p>
        </div>
      )}

      {showForm && (
        <form className="checkin-form" onSubmit={submit}>
          <label>
            Date
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              {days.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Time
            <select value={time} onChange={(e) => setTime(e.target.value)}>
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            What would you like to talk about?
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} placeholder="Optional" />
          </label>
          <p className="fine">
            This sends a Teams meeting invitation to {LINE_MANAGER.name} for a 30-minute {NEW_STARTER_ROLE.title} check-in.
          </p>
          <button type="submit" className="btn primary block">
            Send invitation in Teams
          </button>
        </form>
      )}

      {lastCheckIn && (
        <div className="checkin-status" role="status">
          <p>
            <strong>Invitation sent</strong> to {LINE_MANAGER.name}
          </p>
          <p className="fine">
            {new Date(lastCheckIn.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at {lastCheckIn.time} · {lastCheckIn.topic}
          </p>
          <p className="fine">Status: awaiting acceptance in Teams</p>
        </div>
      )}

      <div className="teams-feed">
        <p className="eyebrow">From Cancara</p>
        <Feed items={fromCancara} empty="No reminders yet. You will get one at the start of each week." />
      </div>

      <div className="teams-feed">
        <p className="eyebrow">Sent to {MANAGER_FIRST} on Teams</p>
        <Feed items={toManager} empty={`Nothing sent to ${MANAGER_FIRST} yet.`} />
      </div>
    </section>
  );
}
