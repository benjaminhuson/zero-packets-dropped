// Demo data: ten fake new colleagues at different points of the Stride journey, all with the same line manager
// and some with a buddy. Synthetic only: made-up names, @example.com emails (a reserved domain).
//
// Writes straight to the store, so nothing is sent to Teams. Safe to run again: anyone whose email already has a
// Stride account is skipped. The journey state matches what the front end saves (stride/src/store.ts), so signing
// in as one of them shows the same stage that the manager sees.
import { randomBytes } from 'node:crypto';
import type { Note, StarterAccount, StarterState, Store } from '../contracts.js';
import { hashPassword, newInviteCode, sha256 } from '../auth/crypto.js';

// Keep in step with stride/src/stages.ts.
const STAGE_NAMES = ['Conditional offer', 'Get set up', 'Meet your team', 'Get ready', 'Settle in', 'Day one'];
const STEPS: string[][] = [
  ['s0-accept'],
  ['s1-details', 's1-history', 's1-values', 's1-strategy', 's1-benefits', 's1-permissions'],
  ['s2-checkin', 's2-learning', 's2-startdate'],
  ['s3-notice', 's3-device', 's3-photo'],
  ['s4-team', 's4-admin', 's4-objectives', 's4-guidance', 's4-kb', 's4-induction'],
  ['s5-date', 's5-training', 's5-contacts'],
];

type Persona = {
  first: string;
  last: string;
  buddy: boolean;
  invitePending?: boolean; // account created, invite not used yet
  stage?: number; // furthest stage unlocked
  stepsInStage?: number; // steps ticked in that stage
  startInDays?: number; // agreed start date, relative to today
  managerAgreed?: boolean;
  thread?: [from: 'starter' | 'manager' | 'buddy', text: string][];
};

export const PERSONAS: Persona[] = [
  { first: 'Maya', last: 'Fenwick', buddy: true, invitePending: true },
  { first: 'Tom', last: 'Ashdown', buddy: false, invitePending: true },
  { first: 'Liam', last: 'Hartley', buddy: false, stage: 1, stepsInStage: 0 },
  { first: 'Sophie', last: 'Marlow', buddy: true, stage: 1, stepsInStage: 4, thread: [['buddy', 'Hi Sophie, I\'m your buddy. Shout if anything in the set-up steps is unclear.'], ['starter', 'Thanks! Is the benefits portal the same as the one in my offer letter?']] },
  { first: 'Ewan', last: 'Calder', buddy: true, stage: 2, stepsInStage: 1, startInDays: 35, managerAgreed: false },
  { first: 'Hannah', last: 'Brightwell', buddy: false, stage: 2, stepsInStage: 2 },
  { first: 'Kwame', last: 'Osei-Banks', buddy: true, stage: 3, stepsInStage: 2, startInDays: 28, managerAgreed: true },
  { first: 'Grace', last: 'Linnell', buddy: false, stage: 4, stepsInStage: 3, startInDays: 20, managerAgreed: true },
  { first: 'Daniel', last: 'Varga', buddy: true, stage: 5, stepsInStage: 1, startInDays: 5, managerAgreed: true, thread: [['manager', 'Looking forward to Monday, Daniel. I\'ll meet you at reception at 9.'], ['starter', 'Great, see you then!'], ['buddy', 'Lunch on day one is on me.']] },
  { first: 'Chloe', last: 'Penrose', buddy: false, stage: 5, stepsInStage: 3, startInDays: -2, managerAgreed: true },
];

export interface SeededRow {
  name: string;
  email: string;
  stage: string;
  buddy: string;
  password: string | null; // set when the account is ready to sign in
  inviteCode: string | null; // set when the invite is still unused
  skipped: boolean; // already existed
}

const day = (now: Date, offset: number) => new Date(now.getTime() + offset * 86400000).toISOString().slice(0, 10);
const id = (prefix: string) => `${prefix}-${randomBytes(6).toString('hex')}`;

function journeyState(p: Persona, now: Date) {
  const stage = p.stage ?? 0;
  const stepsDone = [
    ...STEPS.slice(0, stage).flat(),
    ...STEPS[stage].slice(0, p.stepsInStage ?? 0),
  ];
  const startDate = p.startInDays === undefined ? null : day(now, p.startInDays);
  const flow = {
    accepted: true,
    details: stage >= 1 && (p.stepsInStage ?? 0) > 0 || stage > 1
      ? { preferredName: p.first, mobile: '07700 900000', personalEmail: '' }
      : null,
    vettingComplete: stage >= 2,
    stepsDone,
    startDate,
    starterAgreedDate: startDate !== null,
    managerAgreedDate: !!p.managerAgreed,
    noticeConfirmed: stage >= 3 && stepsDone.includes('s3-notice'),
    device: stepsDone.includes('s3-device') ? 'mac' : null,
    photoName: stage >= 4 ? 'photo.jpg' : null,
    objectives: stepsDone.includes('s4-objectives') ? 'Learn the team\'s services; ship a first small change.' : '',
    upn: null,
    laptopSent: stage >= 5,
    emergencyContacts: stepsDone.includes('s5-contacts') ? 'Sample contact, 07700 900001' : '',
    demoApproaching: false,
    demoStarted: false,
  };
  const announced = Array.from({ length: stage }, (_, i) => i + 1);
  return {
    stage,
    stepsDone: stepsDone.length,
    startDate,
    state: {
      registered: true,
      firstName: p.first,
      flow,
      viewStage: stage,
      announced,
      shares: [],
      checkIns: [],
      teams: [],
      chat: [],
      lastVisit: new Date(now.getTime() - 86400000).toISOString(),
    },
  };
}

export async function seedDemo(store: Store, opts: { managerUpn: string; buddyUpn: string; now: Date; buddyName?: string; managerName?: string }): Promise<SeededRow[]> {
  const managerUpn = opts.managerUpn.toLowerCase();
  const buddyUpn = opts.buddyUpn.toLowerCase();
  const names = { manager: opts.managerName ?? managerUpn.split('@')[0], buddy: opts.buddyName ?? buddyUpn.split('@')[0] };
  const rows: SeededRow[] = [];

  for (const p of PERSONAS) {
    const email = `${p.first}.${p.last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com';
    const name = `${p.first} ${p.last}`;
    const buddy = p.buddy ? buddyUpn : '-';
    if (await store.findStarterByEmail(email)) {
      rows.push({ name, email, stage: '(already there)', buddy, password: null, inviteCode: null, skipped: true });
      continue;
    }

    const account: StarterAccount = {
      id: id('str'),
      firstName: p.first,
      lastName: p.last,
      email,
      passwordHash: null,
      inviteHash: null,
      inviteExpiresAt: null,
      managerUpn,
      buddyUpn: p.buddy ? buddyUpn : null,
      upn: null,
      entraLinkedAt: null,
      createdAt: new Date(opts.now.getTime() - 7 * 86400000).toISOString(),
    };

    if (p.invitePending) {
      const code = newInviteCode();
      await store.saveStarter({ ...account, inviteHash: sha256(code), inviteExpiresAt: new Date(opts.now.getTime() + 14 * 86400000).toISOString() });
      rows.push({ name, email, stage: 'Invite not used yet', buddy, password: null, inviteCode: code, skipped: false });
      continue;
    }

    const password = `Demo-${randomBytes(6).toString('base64url')}`;
    await store.saveStarter({ ...account, passwordHash: await hashPassword(password) });
    const j = journeyState(p, opts.now);
    const saved: StarterState = {
      userId: account.id,
      savedAt: opts.now.toISOString(),
      state: j.state,
      summary: { stage: j.stage, stageName: STAGE_NAMES[j.stage], stagesTotal: STAGE_NAMES.length, stepsDone: j.stepsDone, startDate: j.startDate },
    };
    await store.saveStarterState(saved);

    let minutes = 60 * 24;
    for (const [from, text] of p.thread ?? []) {
      const note: Note = {
        id: id('note'),
        starterId: account.id,
        from,
        fromName: from === 'starter' ? p.first : names[from],
        text,
        sentAt: new Date(opts.now.getTime() - minutes * 60000).toISOString(),
      };
      await store.appendNote(note);
      minutes -= 90;
    }
    rows.push({ name, email, stage: `${j.stage}: ${STAGE_NAMES[j.stage]}`, buddy, password, inviteCode: null, skipped: false });
  }
  return rows;
}
