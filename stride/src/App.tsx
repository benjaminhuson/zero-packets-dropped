import { useState } from 'react';
import { Entry } from './components/Entry';
import { Journey } from './components/Journey';
import { Checklist } from './components/Checklist';
import { useJourney } from './store';

export default function App() {
  const { state, register, goTo, completeCurrent, toggleTask, reset, doneCount } = useJourney();
  const [checklistOpen, setChecklistOpen] = useState(false);

  if (!state.registered) {
    return <Entry onRegister={register} />;
  }

  return (
    <>
      <Journey
        state={state}
        doneCount={doneCount}
        onGoTo={goTo}
        onComplete={completeCurrent}
        onOpenChecklist={() => setChecklistOpen(true)}
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
