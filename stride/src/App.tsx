import { useState } from 'react';
import { Entry } from './components/Entry';
import { Journey } from './components/Journey';
import { Checklist } from './components/Checklist';
import { useJourney } from './store';

export default function App() {
  const { state, daysAway, register, goTo, completePage, toggleTask, shareProgress, requestCheckIn, reset } =
    useJourney();
  const [checklistOpen, setChecklistOpen] = useState(false);

  if (!state.registered) {
    return <Entry onRegister={register} />;
  }

  return (
    <>
      <Journey
        state={state}
        daysAway={daysAway}
        onGoTo={goTo}
        onComplete={completePage}
        onOpenChecklist={() => setChecklistOpen(true)}
        onToggleTask={toggleTask}
        onShare={shareProgress}
        onRequestCheckIn={requestCheckIn}
      />
      {checklistOpen && (
        <Checklist ticked={state.ticked} onToggle={toggleTask} onClose={() => setChecklistOpen(false)} />
      )}
      <button className="reset-link" onClick={reset}>
        Reset prototype
      </button>
    </>
  );
}
