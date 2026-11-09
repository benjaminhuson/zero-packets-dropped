import { useState, type FormEvent } from 'react';
import { Horse } from './Horse';
import { api, MICROSOFT_LOGIN } from '../api';

type Props = { onSignedIn: () => void };

// Two ways in: new colleagues use their Stride account (from the invite their line manager gave them);
// line managers, buddies, and colleagues whose Lloyds account is set up use Microsoft sign-in.
export function SignIn({ onSignedIn }: Props) {
  const [mode, setMode] = useState<'login' | 'invite'>('login');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'invite' && password !== confirm) return setError('The passwords do not match.');
    setBusy(true);
    try {
      if (mode === 'invite') await api.redeemInvite(code, password);
      else await api.login(email, password);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="entry">
      <section className="entry-card">
        <div className="entry-brand">
          <Horse size={44} />
          <div>
            <p className="eyebrow">Lloyds · Stride</p>
            <h1>Sign in to Stride</h1>
          </div>
        </div>

        <div className="entry-grid">
          <form className="register" onSubmit={submit}>
            <h2 className="signin-h">New colleague</h2>
            {mode === 'invite' ? (
              <>
                <label htmlFor="code">Invite code</label>
                <input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="From your line manager" autoComplete="one-time-code" required />
                <label htmlFor="pw">Choose a password</label>
                <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} autoComplete="new-password" required />
                <label htmlFor="pw2">Type it again</label>
                <input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={10} autoComplete="new-password" required />
              </>
            ) : (
              <>
                <label htmlFor="email">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
                <label htmlFor="pw">Password</label>
                <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              </>
            )}
            {error && <p className="signin-error" role="alert">{error}</p>}
            <button type="submit" className="btn primary" disabled={busy}>
              {mode === 'invite' ? 'Set password and start' : 'Sign in'}
            </button>
            <button type="button" className="linkish" onClick={() => { setMode(mode === 'invite' ? 'login' : 'invite'); setError(null); }}>
              {mode === 'invite' ? 'I already have a password' : 'I have an invite code'}
            </button>
          </form>

          <div className="register">
            <h2 className="signin-h">Lloyds colleague</h2>
            <p className="fine">
              Line managers, buddies, and new colleagues whose Lloyds account is ready: sign in with your Microsoft work account.
            </p>
            <a className="btn primary" href={MICROSOFT_LOGIN}>Sign in with Microsoft</a>
            {import.meta.env.DEV && <DevStaffLogin onSignedIn={onSignedIn} />}
          </div>
        </div>
      </section>
    </main>
  );
}

// Local development only: there is no App Service sign-in, so pretend to be a Microsoft user.
function DevStaffLogin({ onSignedIn }: Props) {
  const [upn, setUpn] = useState('');
  return (
    <form
      className="register"
      onSubmit={async (e) => {
        e.preventDefault();
        await fetch('/api/dev/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ upn }) });
        onSignedIn();
      }}
    >
      <label htmlFor="devupn">Dev only: act as Microsoft user</label>
      <input id="devupn" type="email" value={upn} onChange={(e) => setUpn(e.target.value)} placeholder="priya@example.test" required />
      <button type="submit" className="btn">Dev sign-in</button>
    </form>
  );
}
