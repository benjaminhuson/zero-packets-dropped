// Journey content, mirrored from stride/src/data.ts.
// TODO (section 1): move this to a single shared package so the front end and backend read one source.

export interface PageDef {
  id: string;
  week: number; // 0 = offer day, 1-13 = week of the 90 days
  title: string;
}

export interface TaskDef {
  id: string;
  label: string;
  group: string; // 'Before you start', 'Offer day', or 'Week N'
  manager?: boolean; // involves the line manager
}

export const TOTAL_WEEKS = 13;

export const PAGES: PageDef[] = [
  { id: 'welcome', week: 0, title: 'Welcome to Lloyds' },
  { id: 'cancara', week: 0, title: 'Meet Cancara' },
  { id: 'lloyds', week: 0, title: 'About Lloyds' },
  { id: 'purpose', week: 0, title: 'Our purpose' },
  { id: 'values', week: 0, title: 'Our values' },
  { id: 'role', week: 0, title: 'Your role' },
  { id: 'team', week: 0, title: 'Your team' },
  { id: 'week1', week: 1, title: 'Settle in' },
  { id: 'week2', week: 2, title: 'Learn the ropes' },
  { id: 'week3', week: 3, title: 'Get involved' },
  { id: 'week4', week: 4, title: 'Find your rhythm' },
  { id: 'week5', week: 5, title: 'Day 30 check-in' },
  { id: 'week6', week: 6, title: 'Take on your first piece of work' },
  { id: 'week7', week: 7, title: 'Share what you have learned' },
  { id: 'week8', week: 8, title: 'Build your network' },
  { id: 'week9', week: 9, title: 'Day 60 feedback' },
  { id: 'week10', week: 10, title: 'Own your next steps' },
  { id: 'week11', week: 11, title: 'Keep building' },
  { id: 'week12', week: 12, title: 'Prepare your review' },
  { id: 'week13', week: 13, title: 'Day 90 review' },
];

export const TASKS: TaskDef[] = [
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

// What the line manager needs to do in each week (sent to them on Teams)
export const MANAGER_ACTIONS: Record<number, string> = {
  1: 'Agree your first objectives with the new starter and check they have booked coffees with the team',
  2: 'Check the induction e-learning is on track',
  5: 'Hold the Day 30 check-in. The agenda is in Stride',
  9: 'Ask for Day 60 feedback from the new starter',
  13: 'Run the Day 90 review and agree next steps',
};

export const MANAGER_NAME = 'Priya Shah';

// 'Week 5' -> 5, 'Offer day' and 'Before you start' -> 0
export function weekOfGroup(group: string): number {
  return group.startsWith('Week ') ? parseInt(group.slice(5), 10) : 0;
}
