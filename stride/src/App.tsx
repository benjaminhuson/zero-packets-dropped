import { Entry } from './components/Entry';
import { StageJourney } from './components/StageJourney';
import { CancaraChat } from './components/CancaraChat';
import { SignIn } from './components/SignIn';
import { StaffHome } from './components/StaffHome';
import { NotesThread } from './components/NotesThread';
import { useJourney } from './store';
import { api, MICROSOFT_LOGIN, MICROSOFT_LOGOUT, type Me, type Note } from './api';
import { useCallback, useEffect, useState } from 'react';

type Session = Me | 'signed-out' | 'offline' | 'loading';

export default function App() {
  const [session, setSession] = useState<Session>('loading');
  const check = useCallback(() => { void api.me().then(setSession); }, []);
  useEffect(check, [check]);

  if (session === 'loading') return null;
  if (session === 'signed-out') return <SignIn onSignedIn={check} />;
  if (session === 'offline') return <Journey />; // no API: prototype mode, this browser only
  if (session.kind === 'staff') return <StaffHome name={session.name} upn={session.upn} />;
  return <Journey me={session} onSignedOut={check} />;
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
        <button className="linkish" onClick={signOut}>Sign out</button>
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

  if (!state.registered) {
    return <>{bar}<Entry onRegister={journey.register} /></>;
  }

  return (
    <>
      {bar}
      <StageJourney
        state={state}
        openStage={journey.openStage}
        toggleStep={journey.toggleStep}
        saveDetails={journey.saveDetails}
        setDevice={journey.setDevice}
        uploadPhoto={journey.uploadPhoto}
        confirmNotice={journey.confirmNotice}
        saveObjectives={journey.saveObjectives}
        saveContacts={journey.saveContacts}
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
      />
      {!me && <button className="reset-link" onClick={journey.reset}>Reset prototype</button>}
    </>
  );
}
