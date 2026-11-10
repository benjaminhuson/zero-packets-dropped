import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/store/memory.js';
import { PeopleService } from '../src/api/people.js';
import { seedDemo, PERSONAS } from '../src/demo/seed.js';
import type { Caller } from '../src/contracts.js';

const now = new Date('2026-11-10T09:00:00Z');
const opts = { managerUpn: 'Team03-Priya@example.test', buddyUpn: 'team03-ben@example.test', now };

test('demo seed: ten colleagues for the manager, some with the buddy, signed in or invited', async () => {
  const store = new MemoryStore();
  const rows = await seedDemo(store, opts);
  assert.equal(rows.length, PERSONAS.length);
  assert.ok(rows.every((r) => r.email.endsWith('@example.com')));

  const people = new PeopleService(store, { now: () => now });
  const manager: Caller = { kind: 'staff', upn: 'team03-priya@example.test', name: 'Priya' };
  const buddy: Caller = { kind: 'staff', upn: 'team03-ben@example.test', name: 'Ben' };
  const cards = await people.listMine(manager);
  assert.equal(cards.length, 10);
  assert.equal(cards.filter((c) => c.invitePending).length, 2);
  assert.equal((await people.listMine(buddy)).length, PERSONAS.filter((p) => p.buddy).length);
  assert.deepEqual([...new Set(cards.filter((c) => c.summary).map((c) => c.summary!.stage))].sort(), [1, 2, 3, 4, 5]);

  // The printed password and invite code really work.
  const withPassword = rows.find((r) => r.password)!;
  await people.signIn(withPassword.email, withPassword.password!);
  const invited = rows.find((r) => r.inviteCode)!;
  await people.redeemInvite(invited.inviteCode!, 'correct horse battery');
});

test('demo seed is safe to run again', async () => {
  const store = new MemoryStore();
  await seedDemo(store, opts);
  const again = await seedDemo(store, opts);
  assert.ok(again.every((r) => r.skipped && !r.password && !r.inviteCode));
  assert.equal((await store.listStartersForStaff('team03-priya@example.test')).length, 10);
});
