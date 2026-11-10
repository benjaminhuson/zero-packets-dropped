// SYNTHETIC mock people for demos. Stands in for the backend feed of managers, buddies and new starters.
// No real person is represented. Replace with the backend response when it is connected.

export interface Person {
  name: string;
  role: string;
  team?: string;
}

export interface Scenario {
  manager: Person;
  buddy: Person;
  starter: Person;
}

const FIRST = ['Amelia', 'Oliver', 'Sophie', 'Harry', 'Chloe', 'George', 'Isla', 'Jack', 'Freya', 'Leo', 'Grace', 'Noah', 'Ava', 'Ethan', 'Mia', 'Lucas', 'Ruby', 'Oscar', 'Ella', 'Daniel', 'Ivy', 'Samuel', 'Hannah', 'Thomas', 'Lily'];
const LAST = ['Hughes', 'Patel', 'Morgan', 'Reid', 'Khan', 'Brooks', 'Evans', 'Ward', 'Shah', 'Fisher', 'Clarke', 'Bennett', 'Hayes', 'Murray', 'Owen', 'Price', 'Doyle', 'Barker', 'Ellis', 'Grant', 'Lowe', 'Marsh', 'Nolan', 'Ogden', 'Quinn'];

const MANAGER_ROLES = ['Engineering Manager', 'Team Lead, Platform', 'Head of Engineering Delivery', 'Engineering Team Lead', 'Principal Engineer, Digital', 'Engineering Manager, Payments', 'Team Lead, Data Engineering', 'Engineering Manager, Mobile', 'Delivery Lead, Cloud', 'Engineering Manager, Security'];
const TEAMS = ['Digital Engineering', 'Payments Engineering', 'Platform Engineering', 'Data Engineering', 'Mobile Engineering', 'Cloud and Infrastructure', 'Security Engineering', 'Customer Journeys Engineering'];
const BUDDY_ROLES = ['Software Engineer', 'Senior Software Engineer', 'Engineer, Platform', 'Data Engineer', 'Software Engineer, Mobile', 'Cloud Engineer', 'Security Engineer', 'Test Engineer'];
const STARTER_TITLES = ['Software Engineer', 'Graduate Software Engineer', 'Data Engineer', 'Cloud Engineer', 'Mobile Engineer', 'Test Engineer'];

const name = (i: number, offset: number) => `${FIRST[(i + offset) % FIRST.length]} ${LAST[(i * 3 + offset) % LAST.length]}`;

// 25 scenarios. Scenario i pairs one manager, one buddy and one new starter.
export const SCENARIOS: Scenario[] = Array.from({ length: 25 }, (_, i) => ({
  manager: { name: name(i, 0), role: MANAGER_ROLES[i % MANAGER_ROLES.length], team: TEAMS[i % TEAMS.length] },
  buddy: { name: name(i, 7), role: BUDDY_ROLES[i % BUDDY_ROLES.length], team: TEAMS[i % TEAMS.length] },
  starter: { name: name(i, 13), role: STARTER_TITLES[i % STARTER_TITLES.length], team: TEAMS[i % TEAMS.length] },
}));
