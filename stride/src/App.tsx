import { Entry } from './components/Entry';
import { StageJourney } from './components/StageJourney';
import { CancaraChat } from './components/CancaraChat';
import { useJourney } from './store';

export default function App() {
  const journey = useJourney();
  const { state } = journey;

  if (!state.registered) {
    return <Entry onRegister={journey.register} />;
  }

  return (
    <>
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
      <button className="reset-link" onClick={journey.reset}>Reset prototype</button>
    </>
  );
}
