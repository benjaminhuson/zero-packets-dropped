import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Horse } from './Horse';
import { NotesThread } from './NotesThread';
import { api, MICROSOFT_LOGOUT, TEAMS_APP_PACKAGE, type StarterCard, type StarterView } from '../api';
import { STAGES } from '../stages';

type Props = { name: string; upn: string; inTeams?: boolean };

// ---- Helpers ------------------------------------------------------------------------------

const DAY = 86400000;

function startsIn(date: string | null): string {
  if (!date) return '';
  const days = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / DAY);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  return days === -1 ? 'started yesterday' : `started ${-days} days ago`;
}

function ago(iso: string | null): string {
  if (!iso) return 'Not yet';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

const shortDate = (date: string | null) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—';

const upnName = (upn: string | null) => (upn ? upn.split('@')[0].replace(/^team\d+-/, '') : '—');

// Where someone is: -1 = invite not used yet, otherwise their stage.
const position = (c: StarterCard) => (c.invitePending ? -1 : c.summary?.stage ?? 0);

function StageBar({ card }: { card: StarterCard }) {
  const at = position(card);
  return (
    <div className="stagebar" aria-label={at < 0 ? 'Invite not used yet' : `Stage ${at} of ${STAGES.length - 1}: ${STAGES[at]?.name ?? ''}`}>
      <div className="stagebar-track" aria-hidden="true">
        {STAGES.map((s) => (
          <span key={s.id} className={`stagebar-seg${s.id < at ? ' done' : s.id === at ? ' now' : ''}`} />
        ))}
      </div>
      <span className="stagebar-label">{at < 0 ? 'Invite not used yet' : `${at}. ${STAGES[at]?.name ?? ''}`}</span>
    </div>
  );
}

function SignIn({ card }: { card: StarterCard }) {
  if (card.entraLinked) return <span className="tag tag-ok">Work account</span>;
  if (card.upn) return <span className="tag tag-wait" title={card.upn}>Linked, not used yet</span>;
  if (card.invitePending) return <span className="tag tag-muted">Invite sent</span>;
  return <span className="tag">Stride account</span>;
}

// ---- Tabs ------------------------------------------------------------------------------------
// To add a tab (e.g. Aran's feedback): add it to the list in StaffHome below with an id, label and content.

interface Tab {
  id: string;
  label: string;
  badge?: number;
  hidden?: boolean;
  soon?: boolean; // shown, but not available yet
  content: () => ReactNode;
}

// ---- Admin panel ---------------------------------------------------------------------------

// Home for line managers and buddies (Microsoft sign-in): who their new starters are and where each one is.
export function StaffHome({ name, upn, inTeams = false }: Props) {
  const [cards, setCards] = useState<StarterCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<StarterView | null>(null);
  const [invite, setInvite] = useState<{ name: string; code: string; expires: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('starters');

  const refresh = useCallback(async () => {
    try {
      setCards(await api.starters());
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your list');
    }
  }, []);
  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const open = async (id: string) => {
    setError(null);
    try { setSelected(await api.starter(id)); } catch (err) { setError(err instanceof Error ? err.message : 'Could not open'); }
  };
  const reopen = async () => { if (selected) { await open(selected.id); await refresh(); } };

  // Keep the open colleague's chat current (replies can arrive from Teams), every 20 seconds.
  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) return;
    const t = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void api.starter(selectedId).then(setSelected).catch(() => undefined);
    }, 20_000);
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', close);
    return () => { window.clearInterval(t); window.removeEventListener('keydown', close); };
  }, [selectedId]);

  const managing = cards.filter((c) => c.relationship === 'manager');
  const needAction = managing.filter((c) => c.actions.length > 0).length;

  const tabs: Tab[] = [
    { id: 'starters', label: 'New starters', content: () => <StartersTab cards={cards} loaded={loaded} onOpen={open} /> },
    {
      id: 'add',
      label: 'Add a new starter',
      content: () => (
        <AddStarter
          onCreated={async (res) => {
            setInvite({ name: res.starter.name, code: res.inviteCode, expires: res.inviteExpiresAt });
            await refresh();
            setTab('starters');
          }}
        />
      ),
    },
    { id: 'teams', label: 'Microsoft Teams', hidden: inTeams, content: () => <AddToTeams /> },
    { id: 'feedback', label: 'Feedback', soon: true, content: () => null },
  ];
  const current = tabs.find((t) => t.id === tab && !t.hidden && !t.soon) ?? tabs[0];

  return (
    <main className="staff admin">
      <header className="staff-top">
        <div className="entry-brand">
          <Horse size={36} />
          <div>
            <p className="eyebrow">Lloyds · Stride · Manager view</p>
            <h1>Hello {name.split(' ')[0]}</h1>
          </div>
        </div>
        <div className="staff-me">
          {needAction > 0 && <span className="tag tag-action">{needAction} need{needAction === 1 ? 's' : ''} your action</span>}
          <span className="fine">{upn}</span>
          {!inTeams && <a className="linkish" href={MICROSOFT_LOGOUT}>Sign out</a>}
        </div>
      </header>

      {error && <p className="signin-error" role="alert">{error}</p>}

      {invite && (
        <section className="card invite-code" role="status">
          <h3>Invite for {invite.name}</h3>
          <p className="code">{invite.code}</p>
          <p className="fine">
            Give this one-time code to {invite.name} (Stride sends no email in this PoC). It expires on{' '}
            {new Date(invite.expires).toLocaleDateString()}. It is shown only once.
          </p>
          <button className="linkish" onClick={() => setInvite(null)}>Done</button>
        </section>
      )}

      <nav className="admin-tabs" role="tablist" aria-label="Manager view">
        {tabs.filter((t) => !t.hidden).map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={current.id === t.id}
            className={`admin-tab${current.id === t.id ? ' active' : ''}`}
            disabled={t.soon}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.soon && <span className="tab-soon">Soon</span>}
          </button>
        ))}
      </nav>

      <div role="tabpanel">{current.content()}</div>

      {selected && (
        <StarterDrawer
          view={selected}
          onClose={() => setSelected(null)}
          onChanged={reopen}
          onInvite={(code, expires) => setInvite({ name: selected.name, code, expires })}
          onError={setError}
        />
      )}
    </main>
  );
}

// ---- New starters: overview, stage counts and table -------------------------------------------

function StartersTab({ cards, loaded, onOpen }: { cards: StarterCard[]; loaded: boolean; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<number | null>(null); // -1 = invite not used
  const [actionOnly, setActionOnly] = useState(false);

  const counts = useMemo(() => {
    const byStage = new Map<number, number>();
    for (const c of cards) byStage.set(position(c), (byStage.get(position(c)) ?? 0) + 1);
    return byStage;
  }, [cards]);

  const soon = cards.filter((c) => {
    const d = c.summary?.startDate;
    if (!d) return false;
    const days = (new Date(`${d}T00:00:00`).getTime() - Date.now()) / DAY;
    return days >= -1 && days <= 14;
  }).length;
  const needAction = cards.filter((c) => c.actions.length).length;
  const invites = counts.get(-1) ?? 0;

  const rows = cards
    .filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()))
    .filter((c) => stage === null || position(c) === stage)
    .filter((c) => !actionOnly || c.actions.length > 0)
    .sort((a, b) => (b.actions.length > 0 ? 1 : 0) - (a.actions.length > 0 ? 1 : 0) || (a.summary?.startDate ?? '9999').localeCompare(b.summary?.startDate ?? '9999') || a.name.localeCompare(b.name));

  if (loaded && cards.length === 0) {
    return (
      <section className="card admin-empty">
        <h2>No new starters yet</h2>
        <p className="fine">Use <strong>Add a new starter</strong> to create their Stride account. If you're a buddy, you'll see people once their line manager adds you.</p>
      </section>
    );
  }

  return (
    <>
      <section className="kpis" aria-label="Overview">
        <div className="kpi"><span className="kpi-num">{cards.length}</span><span className="kpi-label">New starters</span></div>
        <button className={`kpi${actionOnly ? ' on' : ''}${needAction ? ' alert' : ''}`} onClick={() => setActionOnly(!actionOnly)} aria-pressed={actionOnly}>
          <span className="kpi-num">{needAction}</span><span className="kpi-label">Need your action</span>
        </button>
        <div className="kpi"><span className="kpi-num">{soon}</span><span className="kpi-label">Starting in the next 2 weeks</span></div>
        <button className={`kpi${stage === -1 ? ' on' : ''}`} onClick={() => setStage(stage === -1 ? null : -1)} aria-pressed={stage === -1}>
          <span className="kpi-num">{invites}</span><span className="kpi-label">Invites not used yet</span>
        </button>
      </section>

      <section className="card pipeline" aria-label="New starters by stage">
        <h2>Where everyone is</h2>
        <div className="pipeline-cols">
          {STAGES.map((s) => {
            const n = counts.get(s.id) ?? 0;
            const max = Math.max(1, ...STAGES.map((x) => counts.get(x.id) ?? 0));
            return (
              <button
                key={s.id}
                className={`pipeline-col${stage === s.id ? ' on' : ''}`}
                onClick={() => setStage(stage === s.id ? null : s.id)}
                aria-pressed={stage === s.id}
                aria-label={`Stage ${s.id}, ${s.name}: ${n}`}
              >
                <span className="pipeline-bar"><span style={{ height: `${(n / max) * 100}%` }} /></span>
                <span className="pipeline-n">{n}</span>
                <span className="pipeline-name">{s.id}. {s.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="table-tools">
          <h2>New starters</h2>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" aria-label="Search by name" />
          {(stage !== null || actionOnly || query) && (
            <button className="linkish" onClick={() => { setStage(null); setActionOnly(false); setQuery(''); }}>Clear filters</button>
          )}
        </div>
        <table className="starters">
          <thead>
            <tr>
              <th>Name</th><th>Stage</th><th>Start date</th><th>Buddy</th><th>Sign-in</th><th>Last active</th><th>Needs your action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} onClick={() => onOpen(c.id)} className={c.actions.length ? 'needs' : ''}>
                <td data-label="Name">
                  <button className="row-open" onClick={(e) => { e.stopPropagation(); onOpen(c.id); }}>{c.name}</button>
                  {c.relationship === 'buddy' && <span className="tag tag-muted">You're their buddy</span>}
                </td>
                <td data-label="Stage"><StageBar card={c} /></td>
                <td data-label="Start date">{shortDate(c.summary?.startDate ?? null)}<span className="sub">{startsIn(c.summary?.startDate ?? null)}</span></td>
                <td data-label="Buddy">{c.relationship === 'manager' ? upnName(c.buddyUpn) : 'You'}</td>
                <td data-label="Sign-in"><SignIn card={c} /></td>
                <td data-label="Last active">{ago(c.lastActive)}</td>
                <td data-label="Needs your action">
                  {c.actions.length ? c.actions.map((a) => <span key={a} className="tag tag-action">{a}</span>) : <span className="sub">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="sub">Nobody matches these filters.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

// ---- One new starter: details, manager actions and the team chat ------------------------------

function StarterDrawer({ view, onClose, onChanged, onInvite, onError }: {
  view: StarterView;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onInvite: (code: string, expires: string) => void;
  onError: (message: string | null) => void;
}) {
  const [linkUpn, setLinkUpn] = useState('');
  const [buddyUpn, setBuddyUpn] = useState('');
  const act = (fn: () => Promise<unknown>) => async () => {
    onError(null);
    try { await fn(); await onChanged(); } catch (err) { onError(err instanceof Error ? err.message : 'Something went wrong'); }
  };
  const manager = view.relationship === 'manager';

  return (
    <div className="drawer-wrap" role="dialog" aria-modal="true" aria-label={view.name}>
      <button className="drawer-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="drawer">
        <header className="drawer-head">
          <div>
            <h2>{view.name}</h2>
            <StageBar card={view} />
          </div>
          <button className="team-chat-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        {view.actions.length > 0 && (
          <div className="drawer-actions">
            <strong>Needs your action</strong>
            <ul>{view.actions.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        )}

        <dl className="facts">
          <dt>Start date</dt><dd>{view.summary?.startDate ? `${shortDate(view.summary.startDate)} (${startsIn(view.summary.startDate)})` : 'Not agreed yet'}</dd>
          <dt>Steps done</dt><dd>{view.summary?.stepsDone ?? 0}</dd>
          <dt>Last active</dt><dd>{ago(view.lastActive)}</dd>
          <dt>Sign-in</dt><dd><SignIn card={view} />{view.upn && <span className="sub"> {view.upn}</span>}</dd>
          {manager && <><dt>Buddy</dt><dd>{view.buddyUpn ?? 'None yet'}</dd></>}
          {manager && view.email && <><dt>Personal email</dt><dd>{view.email}</dd></>}
        </dl>

        {manager && (
          <details className="drawer-manage" open={view.actions.includes('Link their work account')}>
            <summary>Manage account</summary>
            <div className="manager-actions">
              {!view.entraLinked && (
                <form onSubmit={(e) => { e.preventDefault(); void act(() => api.linkEntra(view.id, linkUpn))(); }}>
                  <label htmlFor="upn">Link their work (Entra ID) account</label>
                  <input id="upn" type="email" value={linkUpn} onChange={(e) => setLinkUpn(e.target.value)} placeholder="new.colleague@domain" required />
                  <button type="submit" className="btn">Link account</button>
                  <p className="fine">Once linked, they sign in with Microsoft. Their Stride password stops working after their first Microsoft sign-in.</p>
                </form>
              )}
              <form onSubmit={(e) => { e.preventDefault(); void act(() => api.setBuddy(view.id, buddyUpn))(); }}>
                <label htmlFor="buddy">Change buddy</label>
                <input id="buddy" type="email" value={buddyUpn} onChange={(e) => setBuddyUpn(e.target.value)} placeholder="buddy@domain" />
                <button type="submit" className="btn">Save buddy</button>
              </form>
              {!view.entraLinked && (
                <button
                  className="linkish"
                  onClick={async () => {
                    try { const res = await api.reissueInvite(view.id); onInvite(res.inviteCode, res.inviteExpiresAt); await onChanged(); }
                    catch (err) { onError(err instanceof Error ? err.message : 'Could not reissue'); }
                  }}
                >
                  Issue a new invite code (resets their password)
                </button>
              )}
            </div>
          </details>
        )}

        <div className="drawer-chat">
          <h3>Team chat</h3>
          <NotesThread
            viewer={view.relationship}
            notes={view.notes}
            placeholder={`Message ${view.name.split(' ')[0]}`}
            onSend={async (text) => { await api.postStaffNote(view.id, text); await onChanged(); }}
          />
        </div>
      </aside>
    </div>
  );
}

// ---- Add a new starter -------------------------------------------------------------------------

function AddStarter({ onCreated }: { onCreated: (res: Awaited<ReturnType<typeof api.createStarter>>) => Promise<void> }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', buddyUpn: '' });
  const [error, setError] = useState<string | null>(null);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onCreated(await api.createStarter(form));
      setForm({ firstName: '', lastName: '', email: '', buddyUpn: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account');
    }
  };
  return (
    <section className="card add-starter">
      <form className="register" onSubmit={create}>
        <h2>Add a new starter</h2>
        <p className="fine">You become their line manager. They get a one-time invite code to set up their Stride account. Synthetic data only in the hackathon.</p>
        <div className="form-grid">
          <div><label htmlFor="fn">First name</label><input id="fn" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
          <div><label htmlFor="ln">Last name</label><input id="ln" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
          <div><label htmlFor="em">Personal email (their Stride sign-in)</label><input id="em" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div><label htmlFor="bu">Buddy's work account (optional)</label><input id="bu" type="email" value={form.buddyUpn} onChange={(e) => setForm({ ...form, buddyUpn: e.target.value })} placeholder="name@domain" /></div>
        </div>
        {error && <p className="signin-error" role="alert">{error}</p>}
        <button type="submit" className="btn primary">Create Stride account</button>
      </form>
    </section>
  );
}

// ---- Microsoft Teams ------------------------------------------------------------------------------

function AddToTeams() {
  const [teams, setTeams] = useState<{ enabled: boolean; tabLink: string | null } | null>(null);
  useEffect(() => { void api.teams().then(setTeams).catch(() => undefined); }, []);
  if (!teams) return null;
  if (!teams.enabled) return <section className="card"><p className="fine">Teams is not switched on for this deployment.</p></section>;
  return (
    <section className="card teams-card">
      <h2>Stride in Microsoft Teams</h2>
      <p className="fine">Get Stride notifications in Teams, reply to your new starters from there, and open Stride as an app.</p>
      <ol className="fine">
        <li><a href={TEAMS_APP_PACKAGE} download>Download the Stride Teams app</a> (a .zip file; don't unzip it).</li>
        <li>In Teams, go to your team, then <strong>Manage team → Apps → Upload an app → Upload a custom app</strong>, and choose the file.</li>
        <li>Everyone in the team can now get messages from Stride.</li>
        <li>To open Stride as an app in Teams, each person uploads the same file for themselves: <strong>Apps → Manage your apps → Upload an app → Upload a custom app</strong>.</li>
      </ol>
      {teams.tabLink && <a className="linkish" href={teams.tabLink} target="_blank" rel="noreferrer">Open Stride in Teams</a>}
    </section>
  );
}
