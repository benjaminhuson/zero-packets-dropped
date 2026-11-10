import { Entry } from './components/Entry';
import { StageJourney } from './components/StageJourney';
import { CancaraChat } from './components/CancaraChat';
import { useJourney } from './store';
import { Welcome } from './components/Welcome';
import { useState } from 'react';


export default function App() {
  const journey = useJourney();
  const { state } = journey;
  const [chatOpen, setChatOpen] = useState(false);

  if (!state.registered) {
    return <Entry onRegister={journey.register} />;
  }

  if (!state.welcomed) {
    return <Welcome firstName={state.firstName} onContinue={journey.markWelcomed} />;
  }

  return (
    <>
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
      <button className="reset-link" onClick={journey.reset}>Reset prototype</button>
    </>
  );
}
