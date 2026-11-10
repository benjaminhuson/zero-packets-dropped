import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from 'jose';
import { MemoryStore } from '../src/store/memory.js';
import { PeopleService } from '../src/api/people.js';
import { GraphTeamsGateway } from '../src/teams/graph.js';
import { handleActivity } from '../src/teams/bot/handler.js';
import { verifyBotRequest } from '../src/teams/bot/auth.js';
import { checkServiceUrl, type Activity, type BotConnector, type ChannelAccount } from '../src/teams/bot/connector.js';
import { buildPackage, manifest, teamsAppId } from '../src/teams/package.js';
import { scheduleLink } from '../src/teams/meetings.js';
import type { Caller } from '../src/contracts.js';

const TENANT = 'tenant-1';
const SERVICE = 'https://smba.trafficmanager.net/emea/';
const manager: Caller = { kind: 'staff', upn: 'priya@example.test', name: 'Priya' };
const buddy: Caller = { kind: 'staff', upn: 'ben@example.test', name: 'Ben' };

// A Bot Connector stand-in that records what would be sent.
class FakeConnector {
  readonly appId = 'bot-app';
  readonly tenantId = TENANT;
  sent: { conversationId: string; activity: Partial<Activity> }[] = [];
  created: string[] = [];
  updated: { activityId: string; activity: Partial<Activity> }[] = [];
  async update(_s: string, _c: string, activityId: string, activity: Partial<Activity>) { this.updated.push({ activityId, activity }); return {}; }
  roster: ChannelAccount[] = [];
  async send(_s: string, conversationId: string, activity: Partial<Activity>) { this.sent.push({ conversationId, activity }); return {}; }
  async createPersonalConversation(_s: string, _t: string, teamsUserId: string) { this.created.push(teamsUserId); return `a:${teamsUserId}`; }
  async getMember(_s: string, _c: string, memberId: string) { return this.roster.find((m) => m.id === memberId)!; }
  async listTeamMembers() { return this.roster; }
}

const member = (upn: string, n: number): ChannelAccount => ({ id: `29:${n}`, name: upn.split('@')[0], aadObjectId: `oid-${n}`, userPrincipalName: upn });

async function setup() {
  let now = new Date('2026-11-10T09:00:00Z');
  const store = new MemoryStore();
  const connector = new FakeConnector();
  const gateway = new GraphTeamsGateway({ store, connector: connector as unknown as BotConnector, meetings: null, appUrl: 'https://teams.example/tab' });
  const people = new PeopleService(store, { now: () => now }, gateway);
  const { starter, inviteCode } = await people.createStarter(manager, { firstName: 'Alex', lastName: 'Kim', email: 'a@example.test', buddyUpn: 'ben@example.test' });
  const postNote = (caller: Caller, starterId: string, text: string) => people.postNote(caller, text, starterId);
  const ctx = { store, connector: connector as unknown as BotConnector, appUrl: 'https://teams.example/tab', now: () => now, postNote };
  return { store, connector, gateway, people, starter, inviteCode, ctx, advance: (ms: number) => { now = new Date(now.getTime() + ms); }, now: () => now };
}

test('adding the app to a team saves every member as a Teams contact; other tenants are ignored', async () => {
  const { store, connector, ctx } = await setup();
  connector.roster = [member('Priya@example.test', 1), member('ben@example.test', 2)];
  await handleActivity({ type: 'conversationUpdate', serviceUrl: SERVICE, channelData: { tenant: { id: 'someone-else' }, team: { id: 'team-1' } } }, ctx);
  assert.equal(await store.getTeamsContact('priya@example.test'), null);
  await handleActivity({ type: 'conversationUpdate', serviceUrl: SERVICE, channelData: { tenant: { id: TENANT }, team: { id: 'team-1' } } }, ctx);
  assert.equal((await store.getTeamsContact('priya@example.test'))?.teamsUserId, '29:1');
  assert.equal((await store.getTeamsContact('ben@example.test'))?.conversationId, null);
});

test('team thread messages reach the other two people in Teams, opening a 1:1 chat once', async () => {
  const { connector, people, starter, ctx } = await setup();
  connector.roster = [member('priya@example.test', 1), member('ben@example.test', 2)];
  await handleActivity({ type: 'conversationUpdate', serviceUrl: SERVICE, channelData: { tenant: { id: TENANT }, team: { id: 'team-1' } } }, ctx);

  await people.postNote(manager, 'Welcome!', starter.id); // -> buddy (the colleague is not in Teams yet)
  assert.deepEqual(connector.sent.map((x) => x.conversationId), ['a:29:2']);
  await people.postNote(buddy, 'Coffee?', starter.id); // -> manager
  await people.postNote(buddy, 'Monday?', starter.id); // -> manager again, same chat
  assert.deepEqual(connector.created, ['29:2', '29:1']);
  assert.equal(connector.sent.length, 3);
  const card = connector.sent[1].activity.attachments?.[0].content as { body: { text: string }[] };
  assert.equal(card.body[0].text, 'Team thread: Ben');
});

test('saving state delivers new manager messages and check-ins once, and skips old history', async () => {
  const { connector, people, starter, ctx, now } = await setup();
  connector.roster = [member('priya@example.test', 1)];
  await handleActivity({ type: 'conversationUpdate', serviceUrl: SERVICE, channelData: { tenant: { id: TENANT }, team: { id: 'team-1' } } }, ctx);
  const asStarter: Caller = { kind: 'starter', userId: starter.id, name: 'Alex', via: 'stride' };
  const old = { id: 'm0', sentAt: '2026-11-01T09:00:00Z', direction: 'to-manager', kind: 'progress', text: 'old news' };
  const q = { id: 'm1', sentAt: now().toISOString(), direction: 'to-manager', kind: 'question', text: 'Do I need a suit?' };
  const checkIn = { id: 'c1', date: '2026-11-12', time: '10:30', topic: 'First week', status: 'sent' };

  await people.saveState(asStarter, { teams: [q, old] }, {});
  await people.saveState(asStarter, { teams: [q, old] }, {}); // same again: nothing new
  assert.equal(connector.sent.length, 1);
  assert.match(connector.sent[0].activity.text ?? '', /Alex: Do I need a suit\?/);

  await people.saveState(asStarter, { teams: [q, old], checkIns: [checkIn] }, {});
  assert.equal(connector.sent.length, 2);
  const card = connector.sent[1].activity.attachments?.[0].content as { actions: { title: string; url: string }[] };
  assert.equal(card.actions[0].title, 'Schedule in Teams');
  assert.match(card.actions[0].url, /^https:\/\/teams\.microsoft\.com\/l\/meeting\/new\?/);
});

test('the colleague only gets Teams messages once their Entra account is in use', async () => {
  const { store, connector, gateway, people, starter, ctx } = await setup();
  connector.roster = [member('alex.kim@example.test', 3)];
  await handleActivity({ type: 'conversationUpdate', serviceUrl: SERVICE, channelData: { tenant: { id: TENANT }, team: { id: 'team-1' } } }, ctx);
  await people.linkEntra(manager, starter.id, 'alex.kim@example.test');
  await gateway.sendToStarter(starter.id, 'hello');
  assert.equal(connector.sent.length, 0); // linked but not signed in yet
  const account = (await store.getStarter(starter.id))!;
  await store.saveStarter({ ...account, entraLinkedAt: '2026-11-10T10:00:00Z' });
  await gateway.sendToStarter(starter.id, 'hello');
  assert.equal(connector.sent.length, 1);
});

test('Teams delivery failures never break the Stride action', async () => {
  const { connector, people, starter, ctx } = await setup();
  connector.roster = [member('ben@example.test', 2)];
  await handleActivity({ type: 'conversationUpdate', serviceUrl: SERVICE, channelData: { tenant: { id: TENANT }, team: { id: 'team-1' } } }, ctx);
  connector.createPersonalConversation = async () => { throw new Error('Teams is down'); };
  const note = await people.postNote(manager, 'Still saved', starter.id);
  assert.equal(note.text, 'Still saved');
});

test('bot requests: only correctly signed tokens for our bot and serviceUrl are accepted', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  const keys = { botFramework: createLocalJWKSet({ keys: [jwk] }), entra: createLocalJWKSet({ keys: [jwk] }) };
  const settings = { appId: 'bot-app', tenantId: TENANT, keys };
  const sign = (claims: Record<string, unknown>, iss = 'https://api.botframework.com', aud = 'bot-app') =>
    new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime('5m').sign(privateKey);

  await verifyBotRequest(`Bearer ${await sign({ serviceurl: SERVICE })}`, SERVICE, settings);
  await verifyBotRequest(`Bearer ${await sign({}, `https://login.microsoftonline.com/${TENANT}/v2.0`)}`, SERVICE, settings);
  await assert.rejects(verifyBotRequest(`Bearer ${await sign({}, 'https://api.botframework.com', 'another-bot')}`, SERVICE, settings));
  await assert.rejects(verifyBotRequest(`Bearer ${await sign({}, 'https://evil.example')}`, SERVICE, settings));
  await assert.rejects(verifyBotRequest(`Bearer ${await sign({ serviceurl: 'https://smba.trafficmanager.net/other/' })}`, SERVICE, settings));
  await assert.rejects(verifyBotRequest(null, SERVICE, settings));
});

test('the bot only calls Microsoft Bot Connector hosts', () => {
  assert.equal(checkServiceUrl('https://smba.trafficmanager.net/emea'), 'https://smba.trafficmanager.net/emea/');
  assert.throws(() => checkServiceUrl('https://attacker.trafficmanager.net/'));
  assert.throws(() => checkServiceUrl('http://smba.trafficmanager.net/emea/'));
  assert.throws(() => checkServiceUrl('https://example.com/'));
});

test('Teams app package: valid zip with a manifest that matches the deployment', async () => {
  const s = { appUrl: 'https://app-team03-stride-ab12.azurewebsites.net', botAppId: 'bot-app', entraClientId: 'client-1', teamNumber: '03' };
  const m = manifest(s, new Date('2026-11-10T15:32:00Z'));
  assert.equal(m.id, teamsAppId('bot-app'));
  assert.match(m.id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(m.version, '1.261110.1532');
  assert.equal(m.bots[0].botId, 'bot-app');
  assert.equal(m.webApplicationInfo.resource, 'api://app-team03-stride-ab12.azurewebsites.net/client-1');
  assert.deepEqual(m.validDomains, ['app-team03-stride-ab12.azurewebsites.net']);

  const dir = mkdtempSync(join(tmpdir(), 'stride-pkg-'));
  const file = join(dir, 'app.zip');
  writeFileSync(file, await buildPackage(s, new Date()));
  const listing = execFileSync('unzip', ['-l', file]).toString();
  for (const name of ['manifest.json', 'color.png', 'outline.png']) assert.match(listing, new RegExp(name));
  const json = JSON.parse(execFileSync('unzip', ['-p', file, 'manifest.json']).toString());
  assert.equal(json.name.short, 'Stride');
});

test('meeting link is a pre-filled Teams new-meeting link', () => {
  const url = new URL(scheduleLink({ organiserUpn: 'p@x', attendeeUpns: ['a@x'], date: '2026-11-12', time: '23:45', minutes: 30, subject: 'S', body: 'B' }));
  assert.equal(url.searchParams.get('startTime'), '2026-11-12T23:45:00');
  assert.equal(url.searchParams.get('endTime'), '2026-11-13T00:15:00');
  assert.equal(url.searchParams.get('attendees'), 'a@x');
});

// ---- Replying from Teams -------------------------------------------------------------

type Card = { body: { type: string; text?: string; id?: string }[]; actions: { type: string; title: string; data?: Record<string, unknown> }[] };
const cardOf = (a: Partial<Activity>) => a.attachments?.[0].content as Card;

async function inTeam(connector: FakeConnector, ctx: Parameters<typeof handleActivity>[1], members: ChannelAccount[]) {
  connector.roster = members;
  await handleActivity({ type: 'conversationUpdate', serviceUrl: SERVICE, channelData: { tenant: { id: TENANT }, team: { id: 'team-1' } } }, ctx);
}

// What Teams sends when someone presses Reply on a card.
function pressReply(card: Card, typed: string, from: ChannelAccount, conversationId: string): Activity {
  const submit = card.actions.find((a) => a.title === 'Reply')!;
  return {
    type: 'message', serviceUrl: SERVICE, replyToId: 'card-1',
    channelData: { tenant: { id: TENANT } },
    conversation: { id: conversationId, conversationType: 'personal' },
    from: { id: from.id }, value: { ...submit.data, reply: typed },
  };
}

test('team thread cards have a reply box; replying from Teams posts to the thread as that person', async () => {
  const { connector, people, starter, ctx, store } = await setup();
  const priya = member('priya@example.test', 1);
  const ben = member('ben@example.test', 2);
  await inTeam(connector, ctx, [priya, ben]);

  await people.postNote(buddy, 'Alex asked about parking', starter.id); // -> Priya's card
  const card = cardOf(connector.sent[0].activity);
  assert.equal(card.body.find((b) => b.type === 'Input.Text')?.id, 'reply');
  assert.ok(card.actions.some((a) => a.type === 'Action.Submit' && a.title === 'Reply'));

  connector.sent = [];
  await handleActivity(pressReply(card, 'There is a car park on site.', priya, 'a:29:1'), ctx);
  const notes = await store.listNotes(starter.id);
  const last = notes[notes.length - 1];
  assert.equal(last.from, 'manager');
  assert.equal(last.text, 'There is a car park on site.');
  // Card redrawn without the reply box; Ben (buddy) is told about Priya's reply.
  assert.equal(connector.updated[0].activityId, 'card-1');
  assert.match(cardOf(connector.updated[0].activity).body.at(-1)?.text ?? '', /You replied: There is a car park/);
  assert.ok(!cardOf(connector.updated[0].activity).body.some((b) => b.type === 'Input.Text'));
  assert.deepEqual(connector.sent.map((x) => x.conversationId), ['a:29:2']);
});

test("a question from the colleague can be answered in Teams; the answer quotes the question", async () => {
  const { connector, people, starter, ctx, store, now } = await setup();
  const priya = member('priya@example.test', 1);
  await inTeam(connector, ctx, [priya]);
  const asStarter: Caller = { kind: 'starter', userId: starter.id, name: 'Alex', via: 'stride' };
  await people.saveState(asStarter, { teams: [{ id: 'q1', sentAt: now().toISOString(), direction: 'to-manager', kind: 'question', text: 'Do I need a suit?' }] }, {});
  const card = cardOf(connector.sent[0].activity);
  await handleActivity(pressReply(card, 'No, smart casual is fine.', priya, 'a:29:1'), ctx);
  const notes = await store.listNotes(starter.id);
  assert.equal(notes[0].text, 'Re: "Do I need a suit?" No, smart casual is fine.');
});

test('replies are refused for people with no access, and empty replies are not sent', async () => {
  const { connector, people, starter, ctx, store } = await setup();
  const priya = member('priya@example.test', 1);
  const eve = member('eve@example.test', 9);
  await inTeam(connector, ctx, [priya, eve]);
  await people.postNote(buddy, 'Hello', starter.id);
  const card = cardOf(connector.sent[0].activity);
  const before = (await store.listNotes(starter.id)).length;

  connector.sent = [];
  await handleActivity(pressReply(card, 'I should not be able to post', eve, 'a:29:9'), ctx); // not manager or buddy
  await handleActivity(pressReply(card, '   ', priya, 'a:29:1'), ctx); // empty
  assert.equal((await store.listNotes(starter.id)).length, before);
  assert.deepEqual(connector.sent.map((x) => cardOf(x.activity).body[0].text), ['Not sent', 'Nothing sent']);
  assert.equal(connector.updated.length, 0);
});

test("a linked colleague can reply to their own thread from Teams, but not to someone else's", async () => {
  const { connector, people, starter, ctx, store } = await setup();
  const alex = member('alex.kim@example.test', 3);
  await inTeam(connector, ctx, [member('priya@example.test', 1), alex]);
  await people.linkEntra(manager, starter.id, 'alex.kim@example.test');
  const account = (await store.getStarter(starter.id))!;
  await store.saveStarter({ ...account, entraLinkedAt: '2026-11-10T10:00:00Z' });

  await people.postNote(manager, 'Welcome Alex', starter.id); // -> Alex's card
  const card = cardOf(connector.sent.find((x) => x.conversationId === 'a:29:3')!.activity);
  await handleActivity(pressReply(card, 'Thanks Priya!', alex, 'a:29:3'), ctx);
  const notes = await store.listNotes(starter.id);
  assert.equal(notes.at(-1)?.from, 'starter');

  const { starter: other } = await people.createStarter(manager, { firstName: 'Sam', lastName: '', email: 's@example.test', buddyUpn: null });
  const forged = { ...card, actions: card.actions.map((a) => (a.title === 'Reply' ? { ...a, data: { ...a.data, starterId: other.id } } : a)) };
  await handleActivity(pressReply(forged, 'Posting to Sam', alex, 'a:29:3'), ctx);
  assert.equal((await store.listNotes(other.id)).length, 0);
});
