import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JourneyService, HttpError } from '../src/api/service.js';
import { MemoryStore } from '../src/store/memory.js';
import { MockTeamsGateway } from '../src/teams/mock.js';
import { RulesAgent } from '../src/agent/rules.js';
import { PAGES } from '../src/content/journey.js';
import { runCatchUp } from '../src/scheduler/reminders.js';

function setup(startAt = new Date('2027-01-11T09:00:00Z')) {
  let now = startAt;
  const store = new MemoryStore();
  const teams = new MockTeamsGateway();
  const service = new JourneyService(store, teams, new RulesAgent(), { now: () => now });
  return {
    store,
    teams,
    service,
    advance(ms: number) { now = new Date(now.getTime() + ms); },
  };
}

// Complete pages until the user reaches the page index `target`.
async function completeUntil(service: JourneyService, userId: string, target: number) {
  while ((await service.getJourney(userId)).current < target) {
    await service.completePage(userId);
  }
}

test('register creates a journey once and returns the same one after', async () => {
  const { service } = setup();
  const a = await service.register('u1', 'Alex');
  const b = await service.register('u1', 'Someone else');
  assert.equal(a.firstName, 'Alex');
  assert.equal(b.firstName, 'Alex');
});

test('entering week 1 sends the starter a reminder', async () => {
  const { service, teams, store } = setup();
  await service.register('u1', 'Alex');
  const weekOneIndex = PAGES.findIndex((p) => p.week === 1);
  await completeUntil(service, 'u1', weekOneIndex);
  const messages = await store.listMessages('u1');
  assert.ok(messages.some((m) => m.kind === 'reminder' && m.direction === 'to-starter'));
  assert.ok(teams.sent.some((s) => s.to === 'starter'));
});

test('no message reaches the manager without consent', async () => {
  const { service, teams, store } = setup();
  await service.register('u1', 'Alex');
  await completeUntil(service, 'u1', PAGES.findIndex((p) => p.week === 1));
  assert.equal(teams.sent.filter((s) => s.to === 'manager').length, 0);
  assert.equal((await store.listMessages('u1')).filter((m) => m.direction === 'to-manager').length, 0);
  await assert.rejects(service.shareProgress('u1'), (err: unknown) => err instanceof HttpError && err.status === 403);
  await assert.rejects(service.managerSummary('u1'), (err: unknown) => err instanceof HttpError && err.status === 403);
});

test('with consent, entering week 1 tells the manager what to do', async () => {
  const { service, teams } = setup();
  await service.register('u1', 'Alex');
  await service.setConsent('u1', true, 'v1');
  await completeUntil(service, 'u1', PAGES.findIndex((p) => p.week === 1));
  const toManager = teams.sent.filter((s) => s.to === 'manager');
  assert.equal(toManager.length, 1);
  assert.match(toManager[0].text, /Week 1 action for Priya/);
});

test('overdue manager task nudges the starter once, even on repeated catch-ups', async () => {
  const { service, store } = setup();
  await service.register('u1', 'Alex');
  await service.setConsent('u1', true, 'v1');
  // Do not tick week1-goals (a manager task), then move into week 2.
  await completeUntil(service, 'u1', PAGES.findIndex((p) => p.week === 2));
  const overdue = (await store.listMessages('u1')).filter((m) => m.kind === 'overdue');
  assert.equal(overdue.length, 1);
  await service.catchUpCurrentWeek('u1');
  await service.catchUpCurrentWeek('u1');
  assert.equal((await store.listMessages('u1')).filter((m) => m.kind === 'overdue').length, 1);
});

test('scheduled catch-up runs for every user and is idempotent', async () => {
  const { service, store } = setup();
  await service.register('u1', 'Alex');
  await service.register('u2', 'Sam');
  const first = await runCatchUp(store, service);
  const second = await runCatchUp(store, service);
  assert.equal(first.users, 2);
  assert.equal(second.sent, 0, 'second run should send nothing new');
});

test('Cancara escalates questions it cannot answer from Stride content', async () => {
  const { service } = setup();
  await service.register('u1', 'Alex');
  const [, reply] = await service.ask('u1', 'Can you explain my pension tax code?');
  assert.equal(reply.escalate, true);
  const [, holiday] = await service.ask('u1', 'How do I book holiday?');
  assert.equal(holiday.escalate, true);
  const [, values] = await service.ask('u1', 'Tell me about our values');
  assert.equal(values.escalate, false);
});

test('unknown task ids are rejected', async () => {
  const { service } = setup();
  await service.register('u1', 'Alex');
  await assert.rejects(service.toggleTask('u1', 'not-a-task'), (err: unknown) => err instanceof HttpError && err.status === 400);
});

test('check-in requests validate their date and time', async () => {
  const { service } = setup();
  await service.register('u1', 'Alex');
  await service.setConsent('u1', true, 'v1');
  await assert.rejects(service.requestCheckIn('u1', { date: '11/01/2027', time: '10:00', topic: '' }), (err: unknown) => err instanceof HttpError && err.status === 400);
  const ok = await service.requestCheckIn('u1', { date: '2027-01-12', time: '10:00', topic: '' });
  assert.equal(ok.topic, 'Check-in');
});
