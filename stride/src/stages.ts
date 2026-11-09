// Engineering job family PoC. Stages 0-5, each unlocked by the trigger on the previous stage.
// Placeholder content: confirm copy and triggers with the Lloyds team before any real use.

export type Owner = 'you' | 'manager' | 'system';

export type StepKind =
  | 'auto' // system does it (shown as done or waiting)
  | 'info' // read-only text
  | 'check' // tick off
  | 'link' // a link to learning or articles
  | 'details' // personal details form
  | 'values' // values explorer
  | 'date' // propose a start date
  | 'meeting' // request a check-in with the line manager
  | 'device' // Mac or Windows
  | 'photo' // building access photo upload
  | 'objectives' // free-text objectives
  | 'contacts' // emergency contacts
  | 'upn' // manager enters the new starter's UPN (Entra ID)
  | 'laptop'; // laptop dispatched (IT)

export interface Step {
  id: string;
  title: string;
  body?: string;
  kind: StepKind;
  owner: Owner;
  href?: string;
}

export interface StageDef {
  id: number;
  name: string;
  summary: string;
  // Plain-language trigger that unlocks the NEXT stage
  trigger: string;
  steps: Step[];
}

export const JOB_FAMILY = 'Engineering';

export const STAGES: StageDef[] = [
  {
    id: 0,
    name: 'Conditional offer',
    summary: 'You said yes. Your Stride account is ready.',
    trigger: 'You accept the job',
    steps: [
      { id: 's0-accept', title: 'You said yes to the job', kind: 'info', owner: 'you', body: 'Welcome to Lloyds. Your offer is accepted.' },
      { id: 's0-account', title: 'Stride account created', kind: 'auto', owner: 'system', body: 'Created automatically once you accept.' },
      { id: 's0-login', title: 'Login sent to your email', kind: 'auto', owner: 'system' },
      { id: 's0-manager', title: 'Line manager and buddy contacted', kind: 'auto', owner: 'system' },
    ],
  },
  {
    id: 1,
    name: 'Get set up',
    summary: 'Confirm your details and get to know Lloyds.',
    trigger: 'Vetting is complete (Workday)',
    steps: [
      { id: 's1-details', title: 'Confirm your details', kind: 'details', owner: 'you', body: 'Linked from Workday. Check these are right.' },
      { id: 's1-history', title: 'Our history', kind: 'check', owner: 'you', body: 'Our history, and how we got to where we are today.' },
      { id: 's1-values', title: 'Our values', kind: 'values', owner: 'you', body: 'Explore the five values, one by one.' },
      { id: 's1-strategy', title: 'Our strategy', kind: 'check', owner: 'you', body: 'Where Lloyds is heading and why.' },
      { id: 's1-benefits', title: 'Your benefits', kind: 'check', owner: 'you', body: 'Pay, pension and wellbeing support.' },
      { id: 's1-permissions', title: 'Your permissions', kind: 'check', owner: 'you', body: 'What access you will have and how we keep it secure.' },
      { id: 's1-vetting', title: 'Vetting', kind: 'auto', owner: 'system', body: 'Completed in Workday. We will tell you here when it is done.' },
    ],
  },
  {
    id: 2,
    name: 'Meet your team',
    summary: 'Talk to your line manager and agree your start date.',
    trigger: 'Start date agreed by you and your line manager',
    steps: [
      { id: 's2-checkin', title: 'Check-in with your line manager', kind: 'meeting', owner: 'you', body: 'Ask for a meeting. Your manager gets a one-click Teams invite.' },
      { id: 's2-learning', title: 'Engineering job family learning', kind: 'link', owner: 'you', body: 'Start with these, picked for the Engineering job family.', href: '#' },
      { id: 's2-startdate', title: 'Agree your start date', kind: 'date', owner: 'you', body: 'Pick a date. Your line manager confirms it.' },
    ],
  },
  {
    id: 3,
    name: 'Get ready',
    summary: 'Notice, device and building access.',
    trigger: 'You upload your building access photo',
    steps: [
      { id: 's3-notice', title: 'Working notice', kind: 'check', owner: 'you', body: 'Confirm you have worked your notice with your previous employer, or are waiting for your start.' },
      { id: 's3-device', title: 'Device choice', kind: 'device', owner: 'you', body: 'Choose a Mac or a Windows laptop.' },
      { id: 's3-photo', title: 'Building access photo', kind: 'photo', owner: 'you', body: 'Upload a photo for the access pass of the building you are registered to.' },
    ],
  },
  {
    id: 4,
    name: 'Settle in',
    summary: 'Meet the team, set objectives, and get your kit.',
    trigger: 'Your start date is approaching',
    steps: [
      { id: 's4-team', title: 'Meet the immediate team', kind: 'check', owner: 'you', body: 'Check-in with your manager and the team.' },
      { id: 's4-admin', title: 'Admin check-up', kind: 'check', owner: 'you', body: 'Make sure every step is done and ask any questions.' },
      { id: 's4-role', title: 'Role-specific learning', kind: 'link', owner: 'manager', body: 'Shared by your line manager, if they have one for you.', href: '#' },
      { id: 's4-objectives', title: 'Your objectives', kind: 'objectives', owner: 'you', body: 'Think about your first performance goals and the KPIs you will track.' },
      { id: 's4-entra', title: 'Account set up in Microsoft Entra ID', kind: 'upn', owner: 'manager', body: 'Your line manager adds your UPN, so your account joins the right group.' },
      { id: 's4-laptop', title: 'Laptop and welcome pack sent', kind: 'laptop', owner: 'system', body: 'Your laptop is on its way.' },
      { id: 's4-guidance', title: 'Laptop guidance', kind: 'link', owner: 'you', body: 'What to do the first time you open your laptop.', href: '#' },
      { id: 's4-kb', title: 'Knowledge base articles', kind: 'link', owner: 'you', body: 'Articles from our knowledge base (ServiceNow).', href: '#' },
      { id: 's4-induction', title: 'Book induction with other new starters', kind: 'check', owner: 'you', body: 'Optional, but recommended.' },
    ],
  },
  {
    id: 5,
    name: 'Day one',
    summary: 'Your start date, training and emergency contacts.',
    trigger: 'Your start date',
    steps: [
      { id: 's5-date', title: 'Your start date', kind: 'info', owner: 'you', body: 'Agreed earlier with your line manager.' },
      { id: 's5-training', title: 'Mandatory training', kind: 'link', owner: 'you', body: 'Statutory and other learning, from Workday.', href: '#' },
      { id: 's5-contacts', title: 'Emergency contacts', kind: 'contacts', owner: 'you', body: 'Who we should contact in an emergency.' },
    ],
  },
];

// Days before the start date that the "approaching" trigger fires
export const APPROACHING_DAYS = 7;
