// All content is placeholder / mock data for the prototype.
// Names, roles and copy must be replaced with approved content before any real use.

export type Person = {
  id: string;
  name: string;
  role: string;
  reportsTo?: string;
  note?: string;
};

export type Checklist = {
  id: string;
  label: string;
  phase: string;
};

export type Checkpoint = {
  id: string;
  title: string;
  kicker: string;
  body: string[];
  // Simple bullet highlights shown beneath the body copy
  highlights?: string[];
  // Optional extra content rendered by the screen
  kind: 'intro' | 'cancara' | 'lloyds' | 'purpose' | 'role' | 'orgchart' | 'milestone';
  checklistIds?: string[];
};

export const NEW_STARTER_ROLE = {
  title: 'Graduate Data Analyst',
  team: 'Customer Insight',
  location: 'Edinburgh (hybrid)',
  startDate: '2027-01-11',
};

export const LINE_MANAGER: Person = {
  id: 'lm',
  name: 'Priya Shah',
  role: 'Team Lead, Customer Insight',
  reportsTo: 'head',
  note: 'Your line manager. They will meet you on day one.',
};

export const BUDDY: Person = {
  id: 'buddy',
  name: 'Ben Carter',
  role: 'Analyst, Customer Insight',
  reportsTo: 'lm',
  note: 'Your human buddy for the first 90 days.',
};

// Org chart: from you upwards to the top (Charlie)
export const ORG_CHAIN: Person[] = [
  { id: 'you', name: 'You', role: NEW_STARTER_ROLE.title, reportsTo: 'lm' },
  LINE_MANAGER,
  { id: 'head', name: 'Sam Okafor', role: 'Head of Customer Insight', reportsTo: 'director' },
  { id: 'director', name: 'Jordan Lee', role: 'Director, Data & Insight', reportsTo: 'charlie' },
  { id: 'charlie', name: 'Charlie', role: 'Chief Executive (placeholder)' },
];

// People you will work with day-to-day
export const WORKING_WITH: Person[] = [
  BUDDY,
  { id: 'p1', name: 'Aisha Rahman', role: 'Senior Analyst', reportsTo: 'lm' },
  { id: 'p2', name: 'Tom Walsh', role: 'Data Engineer', reportsTo: 'lm' },
  { id: 'p3', name: 'Mei Lin', role: 'Insight Partner, Mortgages', reportsTo: 'head' },
];

export const CHECKLIST: Checklist[] = [
  { id: 'accept', label: 'Accept your offer in the Lloyds candidate portal', phase: 'Before you start' },
  { id: 'laptop', label: 'Collect your laptop and register your phone for MFA', phase: 'Before you start' },
  { id: 'cancara', label: 'Read the story of Cancara', phase: 'Welcome' },
  { id: 'purpose', label: 'Read about Lloyds purpose', phase: 'Welcome' },
  { id: 'role', label: 'Review your role and how it links to our purpose', phase: 'Welcome' },
  { id: 'orgchart', label: 'Say hello to your buddy', phase: 'Welcome' },
  { id: 'week1-coffee', label: 'Book a coffee with each person in your team', phase: 'Week 1' },
  { id: 'week1-goals', label: 'Agree your first objectives with your line manager', phase: 'Week 1' },
  { id: 'week2-training', label: 'Complete the induction e-learning modules', phase: 'Week 2' },
  { id: 'day30-check', label: 'Hold your 30-day check-in', phase: 'Day 30' },
  { id: 'day60-feedback', label: 'Share feedback on your first 60 days', phase: 'Day 60' },
  { id: 'day90-review', label: 'Complete your 90-day review', phase: 'Day 90' },
];

export const CHECKPOINTS: Checkpoint[] = [
  {
    id: 'welcome',
    title: 'Welcome to Lloyds',
    kicker: 'Checkpoint 1 · Start here',
    kind: 'intro',
    body: [
      'We are really glad you are here. Stride is your guide for the next 90 days, from today through to your first review.',
      'It is not a test and you will not be overwhelmed. Each checkpoint is short, and you move at your own pace.',
    ],
    highlights: [
      'Weeks 1–2: settle in and meet your team',
      'Days 30–60: find your feet and share feedback',
      'Day 90: look back on what you have achieved',
    ],
    checklistIds: ['accept', 'laptop'],
  },
  {
    id: 'cancara',
    title: 'Meet Cancara',
    kicker: 'Checkpoint 2 · Your AI buddy',
    kind: 'cancara',
    body: [
      'This is Cancara, your AI buddy. Cancara will be with you throughout Stride, pointing you to the next step and answering simple questions.',
      'The black horse has been part of Lloyds for a long time. It is a symbol of strength, reliability and getting you where you need to go.',
    ],
    highlights: ['Cancara is always here when you need a nudge', 'Ask Cancara what happens next at any point'],
    checklistIds: ['cancara'],
  },
  {
    id: 'lloyds',
    title: 'About Lloyds',
    kicker: 'Checkpoint 3 · Our story',
    kind: 'lloyds',
    body: [
      'Lloyds Banking Group has a history stretching back more than 250 years, and today we serve millions of customers across the UK.',
      'We are a bank with a responsibility to the people and communities we serve, and that shapes how we work every day.',
    ],
    highlights: ['One of the UK’s largest retail banks', 'Serving customers in every part of Britain'],
    checklistIds: [],
  },
  {
    id: 'purpose',
    title: 'Our purpose',
    kicker: 'Checkpoint 4 · Why we exist',
    kind: 'purpose',
    body: [
      'Our purpose is to help Britain prosper. Everything we do should move that forward, whether that is supporting a first home, a small business or a pension.',
    ],
    highlights: ['Helping Britain prosper', 'Putting customers at the heart of decisions', 'Doing the right thing, for the long term'],
    checklistIds: ['purpose'],
  },
  {
    id: 'role',
    title: 'Your role',
    kicker: 'Checkpoint 5 · What you will do',
    kind: 'role',
    body: [
      'You have been offered the role of Graduate Data Analyst in Customer Insight. Your work turns customer data into clear answers that help us make better decisions.',
      'That work links straight back to our purpose: understanding customers well helps us support them to prosper.',
    ],
    checklistIds: ['role'],
  },
  {
    id: 'team',
    title: 'Your team',
    kicker: 'Checkpoint 6 · Who you will work with',
    kind: 'orgchart',
    body: [
      'Here is who you will be working with, from your line manager up to the top of the organisation.',
      'Your buddy is your first port of call for anything that feels unclear.',
    ],
    checklistIds: ['orgchart'],
  },
  {
    id: 'week1',
    title: 'Week 1',
    kicker: 'Milestone · Days 1–7',
    kind: 'milestone',
    body: ['Settle in, meet your team and agree your first objectives with your line manager.'],
    checklistIds: ['week1-coffee', 'week1-goals'],
  },
  {
    id: 'week2',
    title: 'Week 2',
    kicker: 'Milestone · Days 8–14',
    kind: 'milestone',
    body: ['Get comfortable with the tools you use every day and complete your induction modules.'],
    checklistIds: ['week2-training'],
  },
  {
    id: 'day30',
    title: 'Day 30',
    kicker: 'Milestone · Check-in',
    kind: 'milestone',
    body: ['Sit down with your line manager and talk through how the first month has gone.'],
    checklistIds: ['day30-check'],
  },
  {
    id: 'day60',
    title: 'Day 60',
    kicker: 'Milestone · Feedback',
    kind: 'milestone',
    body: ['Share how things are going, what is working and what would help you do your best work.'],
    checklistIds: ['day60-feedback'],
  },
  {
    id: 'day90',
    title: 'Day 90',
    kicker: 'Milestone · Your first review',
    kind: 'milestone',
    body: ['Look back on the last 90 days, celebrate what you have achieved and plan what comes next.'],
    highlights: ['Well done for getting this far!'],
    checklistIds: ['day90-review'],
  },
];
