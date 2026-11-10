import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PeopleService } from '../src/api/people.js';
import { HttpError } from '../src/api/service.js';
import { MemoryStore } from '../src/store/memory.js';
import { resolveCaller, SESSION_COOKIE } from '../src/auth/caller.js';
import { signSession } from '../src/auth/crypto.js';
import type { Caller } from '../src/contracts.js';

const SECRET = 'test-secret';
const manager: Caller = { kind: 'staff', upn: 'priya@example.test', name: 'Priya' };
const buddy: Caller = { kind: 'staff', upn: 'ben@example.test', name: 'Ben' };
const stranger: Caller = { kind: 'staff', upn: 'eve@example.test', name: 'Eve' };

function setup() {
  let now = new Date('2026-11-10T09:00:00Z');
  const store = new MemoryStore();
  const people = new PeopleService(store, { now: () => now });
  return { store, people, advance: (ms: number) => { now = new Date(now.getTime() + ms); }, now: () => now };
}

async function rejects(p: Promise<unknown>, status: number) {
  await assert.rejects(p, (e: unknown) => e instanceof HttpError && e.status === status);
}

const easy = (upn: string) => ({ 'x-ms-client-principal-name': upn });
const settings = { mode: 'easyauth' as const, sessionSecret: SECRET };

test('manager creates a colleague, colleague redeems invite and signs in with Stride', async () => {
  const { people } = setup();
  const created = await people.createStarter(manager, { firstName: 'Alex', lastName: 'Kim', email: 'Alex@Example.test', buddyUpn: 'ben@example.test' });
  assert.equal(created.starter.invitePending, true);
  assert.equal(created.inviteCode.length, 10);

  await rejects(people.redeemInvite(created.inviteCode, 'short'), 400);
  await people.redeemInvite(created.inviteCode.toLowerCase(), 'correct horse battery');
  await rejects(people.redeemInvite(created.inviteCode, 'correct horse battery'), 400); // one-time

  const account = await people.signIn('alex@example.test', 'correct horse battery');
  assert.equal(account.id, created.starter.id);
  await rejects(people.signIn('alex@example.test', 'wrong password!'), 401);
});

test('expired invite codes are refused', async () => {
  const { people, advance } = setup();
  const created = await people.createStarter(manager, { firstName: 'Alex', lastName: '', email: 'a@example.test', buddyUpn: null });
  advance(15 * 86400000);
  await rejects(people.redeemInvite(created.inviteCode, 'correct horse battery'), 400);
});

test('only staff can create colleagues; starters cannot', async () => {
  const { people } = setup();
  const starter: Caller = { kind: 'starter', userId: 'x', name: 'X', via: 'stride' };
  await rejects(people.createStarter(starter, { firstName: 'A', lastName: '', email: 'a@example.test', buddyUpn: null }), 403);
  await rejects(people.createStarter(null, { firstName: 'A', lastName: '', email: 'a@example.test', buddyUpn: null }), 401);
});

test('manager and buddy see the colleague; buddy sees less; strangers see nothing', async () => {
  const { people } = setup();
  const { starter } = await people.createStarter(manager, { firstName: 'Alex', lastName: 'Kim', email: 'a@example.test', buddyUpn: 'ben@example.test' });
  const asStarter: Caller = { kind: 'starter', userId: starter.id, name: 'Alex', via: 'stride' };
  await people.saveState(asStarter, { anything: true }, { stage: 2, stageName: 'Meet your team', stagesTotal: 6, stepsDone: 7, startDate: '2027-01-11' });

  const m = await people.view(manager, starter.id);
  assert.equal(m.relationship, 'manager');
  assert.ok('email' in m);
  const b = await people.view(buddy, starter.id);
  assert.equal(b.relationship, 'buddy');
  assert.equal(b.summary?.stageName, 'Meet your team');
  assert.ok(!('email' in b));
  await rejects(people.view(stranger, starter.id), 404);

  assert.equal((await people.listMine(buddy)).length, 1);
  assert.equal((await people.listMine(stranger)).length, 0);
  await rejects(people.linkEntra(buddy, starter.id, 'alex@example.test'), 403); // manager-only
});

test('shared thread: starter, manager and buddy all post and read the same notes', async () => {
  const { people } = setup();
  const { starter } = await people.createStarter(manager, { firstName: 'Alex', lastName: '', email: 'a@example.test', buddyUpn: 'ben@example.test' });
  const asStarter: Caller = { kind: 'starter', userId: starter.id, name: 'Alex', via: 'stride' };
  await people.postNote(asStarter, 'Hi both!');
  await people.postNote(buddy, 'Welcome Alex', starter.id);
  await people.postNote(manager, 'See you Monday', starter.id);
  await rejects(people.postNote(stranger, 'hello', starter.id), 404);
  const notes = await people.starterNotes(asStarter);
  assert.deepEqual(notes.map((n) => n.from), ['starter', 'buddy', 'manager']);
});

test('linking Entra: first Microsoft sign-in becomes the colleague, then the Stride session stops', async () => {
  const { people, store, now } = setup();
  const { starter, inviteCode } = await people.createStarter(manager, { firstName: 'Alex', lastName: '', email: 'a@example.test', buddyUpn: null });
  await people.redeemInvite(inviteCode, 'correct horse battery');
  const cookie = { cookie: `${SESSION_COOKIE}=${signSession({ sub: starter.id, exp: 9999999999 }, SECRET)}` };

  const before = await resolveCaller(cookie, store, settings, now());
  assert.equal(before?.kind, 'starter');

  await rejects(people.linkEntra(manager, starter.id, 'priya@example.test'), 400); // not the manager's own account
  await people.linkEntra(manager, starter.id, 'Alex.Kim@example.test');

  const viaEntra = await resolveCaller(easy('alex.kim@example.test'), store, settings, now());
  assert.deepEqual(viaEntra, { kind: 'starter', userId: starter.id, name: 'Alex', via: 'entra' });
  assert.equal(await resolveCaller(cookie, store, settings, now()), null);
  await rejects(people.signIn('a@example.test', 'correct horse battery'), 409);
});

test('caller resolution: Entra staff, forged cookies and dev headers', async () => {
  const { store, now } = setup();
  assert.deepEqual(await resolveCaller(easy('Priya@Example.test'), store, settings, now()), { kind: 'staff', upn: 'priya@example.test', name: 'Priya' });
  const forged = { cookie: `${SESSION_COOKIE}=${signSession({ sub: 'x', exp: 9999999999 }, 'other-secret')}` };
  assert.equal(await resolveCaller(forged, store, settings, now()), null);
  // Dev headers are ignored when running with Easy Auth.
  assert.equal(await resolveCaller({ 'x-user-id': 'demo', 'x-dev-entra-upn': 'priya@example.test' }, store, settings, now()), null);
  const dev = { mode: 'dev' as const, sessionSecret: SECRET };
  assert.equal((await resolveCaller({ 'x-user-id': 'demo' }, store, dev, now()))?.kind, 'starter');
  assert.equal((await resolveCaller({ 'x-dev-entra-upn': 'priya@example.test' }, store, dev, now()))?.kind, 'staff');
});

test('saved state summary is sanitised', async () => {
  const { people } = setup();
  const asStarter: Caller = { kind: 'starter', userId: 's1', name: 'A', via: 'stride' };
  const saved = await people.saveState(asStarter, {}, { stage: -3, stageName: 42, startDate: 'soon' });
  assert.deepEqual(saved.summary, { stage: 0, stageName: '', stagesTotal: 0, stepsDone: 0, startDate: null, waitingOnManager: [] });
  await rejects(people.saveState(manager, {}, {}), 403);
});

test('admin panel: manager sees actions and last active; buddy sees no actions; colleague sees their team', async () => {
  const { people, store } = setup();
  const { starter } = await people.createStarter(manager, { firstName: 'Alex', lastName: 'Kim', email: 'a@example.test', buddyUpn: 'ben.carter@example.test' });
  const asStarter: Caller = { kind: 'starter', userId: starter.id, name: 'Alex', via: 'stride' };
  await people.saveState(asStarter, {}, { stage: 4, stageName: 'Settle in', stagesTotal: 6, stepsDone: 12, startDate: '2026-12-01', waitingOnManager: ['Confirm the start date', 42] });

  const [m] = await people.listMine(manager);
  assert.deepEqual(m.actions, ['Confirm the start date', 'Link their work account']);
  assert.equal(m.lastActive, '2026-11-10T09:00:00.000Z');
  assert.equal(m.buddyUpn, 'ben.carter@example.test');
  const [b] = await people.listMine({ kind: 'staff', upn: 'ben.carter@example.test', name: 'Ben' });
  assert.deepEqual(b.actions, []);
  assert.equal(b.buddyUpn, null);

  await people.linkEntra(manager, starter.id, 'alex.kim@example.test');
  assert.deepEqual((await people.listMine(manager))[0].actions, ['Confirm the start date']);

  await store.saveTeamsContact({ upn: 'priya@example.test', aadObjectId: 'o', teamsUserId: '29:1', name: 'Priya Shah', serviceUrl: 's', tenantId: 't', conversationId: null, updatedAt: '' });
  const me = await people.me(asStarter);
  assert.ok(me.kind === 'starter');
  assert.deepEqual(me.manager, { name: 'Priya Shah', upn: 'priya@example.test' }); // name from Teams
  assert.deepEqual(me.buddy, { name: 'Ben Carter', upn: 'ben.carter@example.test' }); // tidied from the UPN
});
