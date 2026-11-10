import { scenario } from './profile';

// Synthetic work email addresses for the demo. Replace with the directory values when connected.
const emailFor = (name: string) => `${name.toLowerCase().replace(/ /g, '.')}@lloydsbanking.example`;
export const MANAGER_EMAIL = emailFor(scenario.manager.name);
export const BUDDY_EMAIL = emailFor(scenario.buddy.name);
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
  // Group heading in the checklist: 'Before you start', 'Offer day', or 'Week N'
  group: string;
  // Tasks the line manager is involved in (check-ins, objectives, reviews)
  manager?: boolean;
};

export type PageKind = 'intro' | 'cancara' | 'lloyds' | 'purpose' | 'values' | 'role' | 'team' | 'week';

export type Page = {
  id: string;
  // 0 = offer day (the welcome pages), 1–13 = the week of the 90 days
  week: number;
  title: string;
  kicker: string;
  body: string[];
  highlights?: string[];
  kind: PageKind;
  // Checklist task ids that belong to this page
  tasks?: string[];
};

export const NEW_STARTER_ROLE = {
  title: 'Software Engineer',
  team: 'Engineering',
  location: 'Edinburgh (hybrid)',
  startDate: '2027-01-11',
};

export const LINE_MANAGER: Person = {
  id: 'lm',
  name: scenario.manager.name,
  role: scenario.manager.role,
  reportsTo: 'head',
  note: 'Your line manager. They will meet you in week one.',
};

export const BUDDY: Person = {
  id: 'buddy',
  name: scenario.buddy.name,
  role: scenario.buddy.role,
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

// The five LBG values, as shown on the supplied values poster (public/lbg-values.png).
// Colours are taken from the poster's gradients.
export type LbgValue = {
  id: string;
  name: string;
  tagline: string;
  behaviour: string;
  opposite: string;
  colour: string;
};

export const LBG_VALUES: LbgValue[] = [
  {
    id: 'people-first',
    name: 'People-first',
    tagline: 'We put people first to go further for customers.',
    behaviour: 'We listen and care for people as individuals. We go the extra mile to help customers, colleagues and communities feel more supported, in control and confident about their future.',
    opposite: 'Putting process over people.',
    colour: '#e0445a',
  },
  {
    id: 'bold',
    name: 'Bold',
    tagline: 'We’re bold and take action.',
    behaviour: 'We innovate and do things differently to better serve our customers and grow with purpose. We challenge things that aren’t right, and take action to change them.',
    opposite: 'Letting how we’ve done things before slow us down.',
    colour: '#1a9e8f',
  },
  {
    id: 'inclusive',
    name: 'Inclusive',
    tagline: 'We’re inclusive to value everyone.',
    behaviour: 'We learn about and embrace our differences, and seek out diverse perspectives. We shape what we do and what we offer around the different needs and circumstances of our customers, colleagues and communities.',
    opposite: 'Thinking our perspectives are the only ones that count.',
    colour: '#2f7fd1',
  },
  {
    id: 'sustainable',
    name: 'Sustainable',
    tagline: 'We champion sustainability to care for our planet.',
    behaviour: 'We take responsibility for the impact of our actions on nature and Britain’s transition to net zero. We see the bigger picture and think through the consequences of our decisions.',
    opposite: 'Prioritising short term returns without considering long term impacts.',
    colour: '#3fae49',
  },
  {
    id: 'trust',
    name: 'Trust',
    tagline: 'We trust each other to achieve more together.',
    behaviour: 'We give each other the space and support to take things on and see them through. We are honest with each other and explain our decisions.',
    opposite: 'Getting involved when we’re not needed.',
    colour: '#7b5cc4',
  },
];

// Checklist tasks, grouped by when they happen
export const CHECKLIST: Checklist[] = [
  { id: 'accept', label: 'Accept your offer in the Lloyds candidate portal', group: 'Before you start' },
  { id: 'laptop', label: 'Collect your laptop and register your phone for MFA', group: 'Before you start' },
  { id: 'cancara', label: 'Read the story of Cancara', group: 'Offer day' },
  { id: 'purpose', label: 'Read about Lloyds purpose', group: 'Offer day' },
  { id: 'values', label: 'Learn the five LBG values and what they mean for you', group: 'Offer day' },
  { id: 'role', label: 'Review your role and how it links to our purpose', group: 'Offer day' },
  { id: 'orgchart', label: 'Say hello to your buddy', group: 'Offer day' },
  { id: 'week1-coffee', label: 'Book a coffee with each person in your team', group: 'Week 1' },
  { id: 'week1-goals', label: 'Agree your first objectives with your line manager', group: 'Week 1', manager: true },
  { id: 'week2-training', label: 'Complete the induction e-learning modules', group: 'Week 2' },
  { id: 'week3-shadow', label: 'Shadow a team stand-up', group: 'Week 3' },
  { id: 'week5-check', label: 'Hold your Day 30 check-in with your line manager', group: 'Week 5', manager: true },
  { id: 'week9-feedback', label: 'Share feedback on your first 60 days', group: 'Week 9', manager: true },
  { id: 'week13-review', label: 'Complete your Day 90 review', group: 'Week 13', manager: true },
];

const OFFER_DAY_PAGES: Page[] = [
  {
    id: 'welcome',
    week: 0,
    title: 'Welcome to Lloyds',
    kicker: 'Offer day · Start here',
    kind: 'intro',
    body: [
      'We are really glad you are here. Stride is your guide through your first 90 days, one week at a time.',
      'Each week has a short page and a few tasks. You move at your own pace, and your line manager can see where you are.',
    ],
    highlights: [
      'Weeks 1–2: settle in and meet your team',
      'Weeks 3–8: build your confidence',
      'Weeks 9–13: share feedback and look back on your first 90 days',
    ],
    tasks: ['accept', 'laptop'],
  },
  {
    id: 'cancara',
    week: 0,
    title: 'Meet Cancara',
    kicker: 'Offer day · Your guide',
    kind: 'cancara',
    body: [
      'This is Cancara, your guide. Cancara will be with you throughout Stride, pointing you to the next step and answering simple questions.',
      'The black horse has been part of Lloyds for a long time. It is a symbol of strength, reliability and getting you where you need to go.',
    ],
    highlights: ['Cancara is always here when you need a nudge', 'Ask Cancara what happens next at any point'],
    tasks: ['cancara'],
  },
  {
    id: 'lloyds',
    week: 0,
    title: 'About Lloyds',
    kicker: 'Offer day · Our story',
    kind: 'lloyds',
    body: [
      'Lloyds Banking Group has a history stretching back more than 250 years, and today we serve millions of customers across the UK.',
      'We are a bank with a responsibility to the people and communities we serve, and that shapes how we work every day.',
    ],
    highlights: ['One of the UK’s largest retail banks', 'Serving customers in every part of Britain'],
  },
  {
    id: 'purpose',
    week: 0,
    title: 'Our purpose',
    kicker: 'Offer day · Why we exist',
    kind: 'purpose',
    body: [
      'Our purpose is to help Britain prosper. Everything we do should move that forward, whether that is supporting a first home, a small business or a pension.',
    ],
    highlights: ['Helping Britain prosper', 'Putting customers at the heart of decisions', 'Doing the right thing, for the long term'],
    tasks: ['purpose'],
  },
  {
    id: 'values',
    week: 0,
    title: 'Our values',
    kicker: 'Offer day · How we behave',
    kind: 'values',
    body: [
      'Our values describe how we work together and with customers. They apply to everyone at Lloyds Banking Group, from your first day to the most senior leader.',
      'We use them to guide everyday choices, to recognise great work, and to shape how we are assessed in performance conversations.',
    ],
    highlights: [
      'Each value has a clear “we” statement and a “the opposite is” warning',
      'Use them as a lens when you make a decision or give feedback',
    ],
    tasks: ['values'],
  },
  {
    id: 'role',
    week: 0,
    title: 'Your role',
    kicker: 'Offer day · What you will do',
    kind: 'role',
    body: [
      'You have been offered the role of Graduate Data Analyst in Customer Insight. Your work turns customer data into clear answers that help us make better decisions.',
      'That work links straight back to our purpose: understanding customers well helps us support them to prosper.',
    ],
    tasks: ['role'],
  },
  {
    id: 'team',
    week: 0,
    title: 'Your team',
    kicker: 'Offer day · Who you will work with',
    kind: 'team',
    body: [
      'Here is who you will be working with, from your line manager up to the top of the organisation.',
      'Your buddy is your first port of call for anything that feels unclear.',
    ],
    tasks: ['orgchart'],
  },
];

// One page per week. Weeks 5, 9 and 13 are the Day 30, Day 60 and Day 90 milestones.
const WEEK_PAGES: { id: string; week: number; title: string; body: string[]; tasks?: string[] }[] = [
  { id: 'week1', week: 1, title: 'Settle in', body: ['Find your desk, get your accounts working and meet your team. Book a short coffee with each person and agree your first objectives with your manager.'], tasks: ['week1-coffee', 'week1-goals'] },
  { id: 'week2', week: 2, title: 'Learn the ropes', body: ['Complete your induction e-learning. These modules cover how we work, data protection and our customer commitments.'], tasks: ['week2-training'] },
  { id: 'week3', week: 3, title: 'Get involved', body: ['Start joining the team’s day-to-day work. Shadowing a stand-up is a good way to see how priorities are set.'], tasks: ['week3-shadow'] },
  { id: 'week4', week: 4, title: 'Find your rhythm', body: ['Your work should be settling into a routine. Note anything that is unclear, and raise it with your buddy or line manager.'] },
  { id: 'week5', week: 5, title: 'Day 30 check-in', body: ['Sit down with your manager and talk through the first month. Use this as your chance to ask for what you need and to share what is going well.'], tasks: ['week5-check'] },
  { id: 'week6', week: 6, title: 'Take on your first piece of work', body: ['Pick up a small piece of analysis, with your buddy checking in along the way.'] },
  { id: 'week7', week: 7, title: 'Share what you have learned', body: ['Show the team something you have worked on, however small. Sharing early builds confidence.'] },
  { id: 'week8', week: 8, title: 'Build your network', body: ['Set up a conversation with someone in a team you do not work with day to day. Learning how other parts of the bank work helps your own work.'] },
  { id: 'week9', week: 9, title: 'Day 60 feedback', body: ['Share how things are going: what is working, what would help you do your best work, and what you would like more of.'], tasks: ['week9-feedback'] },
  { id: 'week10', week: 10, title: 'Own your next steps', body: ['Think about where you want to be by the end of your first year, and talk it through with your line manager.'] },
  { id: 'week11', week: 11, title: 'Keep building', body: ['Take on more responsibility where you feel ready. Ask your buddy for honest feedback on how you are doing.'] },
  { id: 'week12', week: 12, title: 'Prepare your review', body: ['Gather the work you are proud of and the feedback you have received, ready for your Day 90 review.'] },
  { id: 'week13', week: 13, title: 'Day 90 review', body: ['Look back on the last 90 days, celebrate what you have achieved and agree what comes next with your manager.'], tasks: ['week13-review'] },
];

export const PAGES: Page[] = [
  ...OFFER_DAY_PAGES,
  ...WEEK_PAGES.map((p) => ({
    ...p,
    kicker: `Week ${p.week} · Days ${(p.week - 1) * 7 + 1}–${p.week * 7}`,
    kind: 'week' as const,
  })),
];

// Timeline: offer day, then one node per week (1–13). Each node points at its first page.
export type TimelineNode = { week: number; label: string; firstPage: number };

export const TIMELINE: TimelineNode[] = (() => {
  const nodes: TimelineNode[] = [{ week: 0, label: 'Offer day', firstPage: 0 }];
  for (let w = 1; w <= 13; w++) {
    const firstPage = PAGES.findIndex((p) => p.week === w);
    nodes.push({ week: w, label: w === 13 ? 'Day 90' : `Week ${w}`, firstPage });
  }
  return nodes;
})();
