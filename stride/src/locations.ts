// Work locations and first-day guidance. PLACEHOLDER: confirm addresses, travel details and
// first-day arrangements with the Lloyds facilities and induction teams before launch.
// Reception numbers are PLACEHOLDERS until facilities confirm them.
export const LOCATIONS = {
  leeds: {
    label: 'Leeds',
    reception: '0113 000 0000 (placeholder)',
    firstDaySteps: [
      { time: 'Before you go', text: 'Check your building pass is in your bag, and plan your route from home. Leave with time to spare.' },
      { time: '09:30', text: 'Arrive at reception and say your name. Your manager or buddy will come to meet you.' },
      { time: '10:00', text: 'Welcome from your manager, and a tour of the building.' },
      { time: '11:00', text: 'Set up your laptop with IT. Sign in with your work email address and follow the guide in Stage 4.' },
      { time: '13:00', text: 'Lunch with your team.' },
      { time: 'Afternoon', text: 'Meet your buddy and go through your first tasks and objectives.' },
      { time: '16:30', text: 'Short catch-up with your manager. Ask anything you are unsure about.' },
    ],
    address: 'Leeds, Wellington Place 11. Please check the building name and entrance with your manager before you travel.',
    getThere: 'The building is a short walk from Leeds station. Trains run to Leeds from across the country. Allow extra time on your first day to find the entrance and reception.',
    firstDay: 'Arrive for 09:30 and go to reception. Bring your building pass, which was posted to your home address. Your manager or buddy will meet you there and show you around.',
    expect: 'A welcome from your manager, a tour of the building, time to set up your laptop with IT, and a relaxed lunch with your team.',
  },
  london: {
    label: 'London',
    reception: '020 0000 0000 (placeholder)',
    firstDaySteps: [
      { time: 'Before you go', text: 'Check your building pass is in your bag, and plan your journey. Leave with time to spare.' },
      { time: '09:30', text: 'Arrive at reception and say your name. Your manager or buddy will come to meet you.' },
      { time: '10:00', text: 'Welcome from your manager, and a tour of the building.' },
      { time: '11:00', text: 'Set up your laptop with IT. Sign in with your work email address and follow the guide in Stage 4.' },
      { time: '13:00', text: 'Lunch with your team.' },
      { time: 'Afternoon', text: 'Meet your buddy and go through your first tasks and objectives.' },
      { time: '16:30', text: 'Short catch-up with your manager. Ask anything you are unsure about.' },
    ],
    address: '10 Gresham Street, London. Please check the entrance with your manager before you travel.',
    getThere: 'The nearest Underground stations are St Paul’s and Bank, both a few minutes’ walk away. Check the travel times on your first day from your home address.',
    firstDay: 'Arrive for 09:30 and go to reception. Bring your building pass, which was posted to your home address. Your manager or buddy will meet you there and show you around.',
    expect: 'A welcome from your manager, a tour of the building, time to set up your laptop with IT, and a relaxed lunch with your team.',
  },
  virtual: {
    label: 'Virtual (Teams)',
    reception: 'No reception. Contact IT helpdesk or your manager on Teams.',
    firstDaySteps: [
      { time: 'Before the day', text: 'Make sure you have your laptop, charger and a quiet space. You will be sent the Teams joining link.' },
      { time: '09:30', text: 'Sign in to your laptop, then join your manager on Teams.' },
      { time: '10:00', text: 'Welcome call with your manager, and a walk through of Teams and the tools you need.' },
      { time: '11:00', text: 'Set-up support from IT, following the guide in Stage 4.' },
      { time: '13:00', text: 'Lunch break.' },
      { time: 'Afternoon', text: 'Introduction to your team on a call, then your buddy call.' },
      { time: '16:30', text: 'Short catch-up with your manager. Ask anything you are unsure about.' },
    ],
    address: 'You will work from home, and join your team in Microsoft Teams.',
    getThere: 'There is no travel. Your manager will send you the Teams invite for your first day.',
    firstDay: 'Sign in to your laptop at 09:30, then join your manager on Teams. You will be sent the joining link before the day.',
    expect: 'A welcome call with your manager, a walk through of Teams and the tools you need, set-up support from IT, and an introduction to your team on a call.',
  },
} as const;
