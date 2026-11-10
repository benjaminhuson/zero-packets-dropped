import { Entry } from './components/Entry';
import { StageJourney } from './components/StageJourney';
import { CancaraChat } from './components/CancaraChat';
import { SignIn } from './components/SignIn';
import { StaffHome } from './components/StaffHome';
import { TeamChat } from './components/TeamChat';
import { TeamContext } from './team';
import { useJourney } from './store';
import { Welcome } from './components/Welcome';
import { api, setBearerTokens, MICROSOFT_LOGIN, MICROSOFT_LOGOUT, type Me } from './api';
import { inTeams, notifyTeamsReady, teamsToken } from './teams';
import { useCallback, useEffect, useState } from 'react';

type Session = Me | 'signed-out' | 'offline' | 'loading' | { kind: 'teams-error'; message: string };

const IN_TEAMS = inTeams();
// Local development only: /?as=<email> signs in as a seeded colleague without a password (e.g. ?as=sophie.marlow@example.com).
// /?chat=1 also opens Cancara on load.
const DEV_AS = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('as') : null;
const DEV_CHAT_SHORTCUT: string | null = DEV_AS;
const DEV_OPEN_CHAT = import.meta.env.DEV && new URLSearchParams(window.location.search).get('chat') === '1';

export default function App() {
  const [session, setSession] = useState<Session>('loading');
  const check = useCallback(() => {
    if (!IN_TEAMS) {
      // Local development only: ?chat=1 signs in as a seeded colleague and opens Cancara.
      if (DEV_CHAT_SHORTCUT) {
        return void fetch('/api/dev/starter-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: DEV_CHAT_SHORTCUT }) })
          .then(() => api.me())
          .then(setSession);
      }
      return void api.me().then(setSession);
    }
    // Inside Teams: sign in silently with the Teams token.
    setBearerTokens(teamsToken);
    void teamsToken()
      .then(() => api.me())
      .then((me) => {
        void notifyTeamsReady().catch(() => undefined);
        setSession(me === 'signed-out' ? { kind: 'teams-error', message: 'Teams signed you in, but Stride did not accept it.' } : me);
      })
      .catch((err: unknown) => setSession({ kind: 'teams-error', message: err instanceof Error ? err.message : String(err) }));
  }, []);
  useEffect(check, [check]);

  if (session === 'loading') return null;
  if (typeof session === 'object' && session.kind === 'teams-error') return <TeamsSignInProblem message={session.message} />;
  if (session === 'signed-out') return <SignIn onSignedIn={check} />;
  if (session === 'offline') return <Journey />; // no API: prototype mode, this browser only
  if (session.kind === 'staff') return <StaffHome name={session.name} upn={session.upn} inTeams={IN_TEAMS} />;
  return (
    <TeamContext.Provider value={{ manager: session.manager, buddy: session.buddy }}>
      <Journey me={session} onSignedOut={check} />
    </TeamContext.Provider>
  );
}

function TeamsSignInProblem({ message }: { message: string }) {
  return (
    <main className="entry">
      <section className="entry-card">
        <h1>Stride could not sign you in through Teams</h1>
        <p className="lead">You can still use Stride in your browser. New colleagues without a work account always use the browser.</p>
        <a className="btn primary" href={window.location.origin} target="_blank" rel="noreferrer">Open Stride in the browser</a>
        <p className="fine">Details: {message}</p>
      </section>
    </main>
  );
}

// The signed-in new colleague, or the offline prototype when `me` is missing.
function SignedInBar({ me, onSignedOut }: { me: Extract<Me, { kind: 'starter' }>; onSignedOut: () => void }) {
  const signOut = async () => {
    if (me.via === 'entra') return window.location.assign(MICROSOFT_LOGOUT);
    await api.logout().catch(() => undefined);
    onSignedOut();
  };

  return (
    <>
      <div className="signed-in-bar">
        <span>Signed in as {me.name}</span>
        {!IN_TEAMS && <button className="linkish" onClick={signOut}>Sign out</button>}
      </div>
      {me.entraLinkPending && (
        <p className="signed-in-note" role="status">
          Your Lloyds account is ready. <a href={MICROSOFT_LOGIN}>Sign in with Microsoft</a> from now on; your Stride password will stop working.
        </p>
      )}
      <TeamChat me={me} />
    </>
  );
}

function Journey({ me, onSignedOut }: { me?: Extract<Me, { kind: 'starter' }>; onSignedOut?: () => void }) {
  const journey = useJourney(me?.id);
  const { state } = journey;
  const bar = me && onSignedOut ? <SignedInBar me={me} onSignedOut={onSignedOut} /> : null;
  const [chatOpen, setChatOpen] = useState(DEV_OPEN_CHAT);

  if (!state.registered) {
    return <>{bar}<Entry onRegister={journey.register} /></>;
  }

  if (!state.welcomed) {
    return <>{bar}<Welcome firstName={state.firstName} onContinue={journey.markWelcomed} /></>;
  }

  return (
    <>
      {bar}
      <StageJourney
        state={state}
        openStage={journey.openStage}
        dismissCelebrate={journey.dismissCelebrate}
        promptCheckIn={journey.promptCheckIn}
        onOpenChat={() => setChatOpen(true)}
        bookCheckInFromChat={journey.bookCheckInFromChat}
        toggleStep={journey.toggleStep}
        saveDetails={journey.saveDetails}
        setDevice={journey.setDevice}
        uploadPhoto={journey.uploadPhoto}
        confirmNotice={journey.confirmNotice}
        saveObjectives={journey.saveObjectives}
        saveContacts={journey.saveContacts}
        setLocation={journey.setLocation}
        agreeStartDate={journey.agreeStartDate}
        managerConfirmDate={journey.managerConfirmDate}
        completeVetting={journey.completeVetting}
        managerSetUpn={journey.managerSetUpn}
        dispatchLaptop={journey.dispatchLaptop}
        simulateApproaching={journey.simulateApproaching}
        simulateStarted={journey.simulateStarted}
        shareProgress={journey.shareProgress}
        requestCheckIn={journey.requestCheckIn}
        notifyManagerOfActions={journey.notifyManagerOfActions}
      />
      <CancaraChat
        state={state}
        onAsk={journey.askCancara}
        onSendToManager={journey.sendQuestionToManager}
        onMessage={journey.messageSomeone}
        onNotifyActions={journey.notifyManagerOfActions}
        onBookCheckIn={journey.bookCheckInFromChat}
        open={chatOpen}
        onOpenChange={setChatOpen}
      />
      {!me && <button className="reset-link" onClick={journey.reset}>Reset prototype</button>}
    </>
  );
}
