import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Horse } from './Horse';
import { NotesThread } from './NotesThread';
import { api, MICROSOFT_LOGOUT, TEAMS_APP_PACKAGE, type StarterCard, type StarterView } from '../api';

type Props = { name: string; upn: string; inTeams?: boolean };

// How to add Stride to Teams. Shown in the browser when Teams is enabled on this deployment.
function AddToTeams() {
  const [teams, setTeams] = useState<{ enabled: boolean; tabLink: string | null } | null>(null);
  useEffect(() => { void api.teams().then(setTeams).catch(() => undefined); }, []);
  if (!teams?.enabled) return null;
  return (
    <section className="card teams-card">
      <h2>Stride in Microsoft Teams</h2>
      <p className="fine">Get Stride notifications in Teams and open Stride as an app there.</p>
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

function Progress({ card }: { card: StarterCard }) {
  if (card.invitePending) return <span className="pill">Invite not used yet</span>;
  if (!card.summary) return <span className="pill">Not started</span>;
  const s = card.summary;
  return (
    <span className="pill on">
      Stage {s.stage} of {Math.max(s.stagesTotal - 1, 0)}: {s.stageName}
    </span>
  );
}

// Home for line managers and buddies (Microsoft sign-in).
export function StaffHome({ name, upn, inTeams = false }: Props) {
  const [cards, setCards] = useState<StarterCard[]>([]);
  const [selected, setSelected] = useState<StarterView | null>(null);
  const [invite, setInvite] = useState<{ name: string; code: string; expires: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCards(await api.starters());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your list');
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const open = async (id: string) => {
    setError(null);
    try { setSelected(await api.starter(id)); } catch (err) { setError(err instanceof Error ? err.message : 'Could not open'); }
  };
  const reopen = async () => { if (selected) { await open(selected.id); await refresh(); } };

  const act = (fn: () => Promise<unknown>) => async () => {
    setError(null);
    try { await fn(); await reopen(); } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong'); }
  };

  // ---- Create a colleague ----
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', buddyUpn: '' });
  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.createStarter(form);
      setInvite({ name: res.starter.name, code: res.inviteCode, expires: res.inviteExpiresAt });
      setForm({ firstName: '', lastName: '', email: '', buddyUpn: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account');
    }
  };

  const [linkUpn, setLinkUpn] = useState('');
  const [buddyUpn, setBuddyUpn] = useState('');

  return (
    <main className="staff">
      <header className="staff-top">
        <div className="entry-brand">
          <Horse size={36} />
          <div>
            <p className="eyebrow">Lloyds · Stride</p>
            <h1>Hello {name}</h1>
          </div>
        </div>
        <div className="staff-me">
          <span className="fine">{upn}</span>
          {!inTeams && <a className="linkish" href={MICROSOFT_LOGOUT}>Sign out</a>}
        </div>
      </header>

      {error && <p className="signin-error" role="alert">{error}</p>}

      {!inTeams && <AddToTeams />}

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

      <div className="staff-grid">
        <section className="card">
          <h2>Your new colleagues</h2>
          {cards.length === 0 && <p className="fine">Nobody yet. Add a new colleague, or ask their line manager to add you as buddy.</p>}
          <ul className="starter-list">
            {cards.map((c) => (
              <li key={c.id}>
                <button className={`starter-row ${selected?.id === c.id ? 'active' : ''}`} onClick={() => open(c.id)}>
                  <strong>{c.name}</strong>
                  <span className="fine">{c.relationship === 'manager' ? 'You are the line manager' : 'You are the buddy'}</span>
                  <Progress card={c} />
                </button>
              </li>
            ))}
          </ul>

          <form className="register" onSubmit={create}>
            <h3>Add a new colleague</h3>
            <p className="fine">You become their line manager. Synthetic data only in the hackathon.</p>
            <label htmlFor="fn">First name</label>
            <input id="fn" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            <label htmlFor="ln">Last name</label>
            <input id="ln" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            <label htmlFor="em">Personal email (their Stride sign-in)</label>
            <input id="em" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <label htmlFor="bu">Buddy's work account (optional)</label>
            <input id="bu" type="email" value={form.buddyUpn} onChange={(e) => setForm({ ...form, buddyUpn: e.target.value })} placeholder="name@domain" />
            <button type="submit" className="btn primary">Create Stride account</button>
          </form>
        </section>

        {selected && (
          <section className="card">
            <h2>{selected.name}</h2>
            <Progress card={selected} />
            {selected.summary && (
              <dl className="facts">
                <dt>Steps done</dt><dd>{selected.summary.stepsDone}</dd>
                <dt>Start date</dt><dd>{selected.summary.startDate ?? 'Not agreed yet'}</dd>
              </dl>
            )}
            <dl className="facts">
              <dt>Sign-in</dt>
              <dd>{selected.entraLinked ? `Microsoft (${selected.upn})` : selected.upn ? `Microsoft account linked (${selected.upn}), not used yet` : 'Stride account'}</dd>
              {selected.relationship === 'manager' && <><dt>Buddy</dt><dd>{selected.buddyUpn ?? 'None yet'}</dd></>}
            </dl>

            {selected.relationship === 'manager' && (
              <div className="manager-actions">
                {!selected.entraLinked && (
                  <form onSubmit={(e) => { e.preventDefault(); void act(() => api.linkEntra(selected.id, linkUpn))(); }}>
                    <label htmlFor="upn">Link their Lloyds (Entra ID) account</label>
                    <input id="upn" type="email" value={linkUpn} onChange={(e) => setLinkUpn(e.target.value)} placeholder="new.colleague@domain" required />
                    <button type="submit" className="btn">Link account</button>
                  </form>
                )}
                <form onSubmit={(e) => { e.preventDefault(); void act(() => api.setBuddy(selected.id, buddyUpn))(); }}>
                  <label htmlFor="buddy">Change buddy</label>
                  <input id="buddy" type="email" value={buddyUpn} onChange={(e) => setBuddyUpn(e.target.value)} placeholder="buddy@domain" />
                  <button type="submit" className="btn">Save buddy</button>
                </form>
                {!selected.entraLinked && (
                  <button
                    className="linkish"
                    onClick={async () => {
                      try {
                        const res = await api.reissueInvite(selected.id);
                        setInvite({ name: selected.name, code: res.inviteCode, expires: res.inviteExpiresAt });
                        await reopen();
                      } catch (err) { setError(err instanceof Error ? err.message : 'Could not reissue'); }
                    }}
                  >
                    Issue a new invite code (resets their password)
                  </button>
                )}
              </div>
            )}

            <NotesThread
              notes={selected.notes}
              onSend={async (text) => { await api.postStaffNote(selected.id, text); await reopen(); }}
            />
          </section>
        )}
      </div>
    </main>
  );
}
