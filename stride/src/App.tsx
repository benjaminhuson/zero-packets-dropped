import { Entry } from './components/Entry';
import { StageJourney } from './components/StageJourney';
import { CancaraChat } from './components/CancaraChat';
import { SignIn } from './components/SignIn';
import { StaffHome } from './components/StaffHome';
import { NotesThread } from './components/NotesThread';
import { useJourney } from './store';
import { Welcome } from './components/Welcome';
import { api, setBearerTokens, MICROSOFT_LOGIN, MICROSOFT_LOGOUT, type Me, type Note } from './api';
import { inTeams, notifyTeamsReady, teamsToken } from './teams';
import { useCallback, useEffect, useState } from 'react';

type Session = Me | 'signed-out' | 'offline' | 'loading' | { kind: 'teams-error'; message: string };

const IN_TEAMS = inTeams();

export default function App() {
  const [session, setSession] = useState<Session>('loading');
  const check = useCallback(() => {
    if (!IN_TEAMS) return void api.me().then(setSession);
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
  return <Journey me={session} onSignedOut={check} />;
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
  const [notes, setNotes] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => { void api.notes().then(setNotes).catch(() => undefined); }, []);
  useEffect(load, [load]);

  const signOut = async () => {
    if (me.via === 'entra') return window.location.assign(MICROSOFT_LOGOUT);
    await api.logout().catch(() => undefined);
    onSignedOut();
  };

  return (
    <>
      <div className="signed-in-bar">
        <span>Signed in as {me.name}</span>
        <button className="linkish" onClick={() => setOpen(!open)}>Team thread ({notes.length})</button>
        {!IN_TEAMS && <button className="linkish" onClick={signOut}>Sign out</button>}
      </div>
      {me.entraLinkPending && (
        <p className="signed-in-note" role="status">
          Your Lloyds account is ready. <a href={MICROSOFT_LOGIN}>Sign in with Microsoft</a> from now on; your Stride password will stop working.
        </p>
      )}
      {open && (
        <div className="thread-popover">
          <NotesThread title="You, your line manager and your buddy" notes={notes} onSend={async (t) => { await api.postNote(t); load(); }} />
        </div>
      )}
    </>
  );
}

function Journey({ me, onSignedOut }: { me?: Extract<Me, { kind: 'starter' }>; onSignedOut?: () => void }) {
  const journey = useJourney(me?.id);
  const { state } = journey;
  const bar = me && onSignedOut ? <SignedInBar me={me} onSignedOut={onSignedOut} /> : null;
  const [chatOpen, setChatOpen] = useState(false);

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
        onNotifyActions={journey.notifyManagerOfActions}
        onBookCheckIn={journey.bookCheckInFromChat}
        open={chatOpen}
        onOpenChange={setChatOpen}
      />
      {!me && <button className="reset-link" onClick={journey.reset}>Reset prototype</button>}
    </>
  );
}
