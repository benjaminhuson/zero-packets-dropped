// Section 1: HTTP routes. Thin: parse the request, call the service, return JSON.
import type { IncomingMessage } from 'node:http';
import type { JourneyService } from './service.js';
import { HttpError } from './service.js';
import { CHECKLIST_IDS } from './ids.js';
import { runCatchUp } from '../scheduler/reminders.js';
import type { Caller, Store } from '../contracts.js';
import { PeopleService } from './people.js';
import { DEV_UPN_COOKIE, SESSION_COOKIE, SESSION_HOURS } from '../auth/caller.js';
import { signSession } from '../auth/crypto.js';
import { seedDemo } from '../demo/seed.js';
import { MemoryStore } from '../store/memory.js';
import { createHash, timingSafeEqual } from 'node:crypto';

// Constant-time check of the x-admin-token header.
function isAdmin(expected: string | null, given: string | null): boolean {
  if (!expected || !given) return false;
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(given).digest();
  return timingSafeEqual(a, b);
}

export interface RequestContext {
  method: string;
  path: string;
  params: Record<string, string>;
  body: unknown;
  caller: Caller | null;
  adminToken: string | null;
  authorization: string | null;
}

export interface HandlerResult {
  status: number;
  body: unknown;
  headers?: Record<string, string | string[]>;
  file?: { contentType: string; data: Buffer; filename: string }; // binary download instead of JSON
}

export type Handler = (ctx: RequestContext) => Promise<HandlerResult>;

export interface Deps {
  service: JourneyService;
  people: PeopleService;
  store: Store;
  adminToken: string | null;
  sessionSecret: string;
  secureCookies: boolean;
  devAuth: boolean; // AUTH=dev only: enables the /api/dev/* stand-ins for Microsoft sign-in
  clock: { now(): Date };
  teams: TeamsRoutes | null; // null when TEAMS=mock
}

// Teams wiring, provided by server.ts when TEAMS=graph.
export interface TeamsRoutes {
  handleBotRequest(authorization: string | null, activity: unknown): Promise<void>;
  appPackage(): Promise<Buffer>;
  tabLink: string;
}

// The signed-in new colleague. Managers and buddies get 403 on starter-only routes.
const need = (caller: Caller | null): string => PeopleService.starterId(caller);

function optStr(body: unknown, key: string): string | null {
  const v = (body as Record<string, unknown> | null)?.[key];
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw new HttpError(400, `"${key}" must be a string`);
  return v;
}

function str(body: unknown, key: string): string {
  const v = (body as Record<string, unknown> | null)?.[key];
  if (typeof v !== 'string') throw new HttpError(400, `"${key}" must be a string`);
  return v;
}

export function buildRoutes(deps: Deps): { method: string; pattern: RegExp; names: string[]; handler: Handler }[] {
  const { service, people } = deps;
  const cookie = (value: string, maxAgeSeconds: number) =>
    `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${deps.secureCookies ? '; Secure' : ''}`;
  const startSession = (starterId: string) => {
    const exp = Math.floor(deps.clock.now().getTime() / 1000) + SESSION_HOURS * 3600;
    return { 'set-cookie': cookie(signSession({ sub: starterId, exp }, deps.sessionSecret), SESSION_HOURS * 3600) };
  };
  const r = (method: string, path: string, handler: Handler) => {
    const names: string[] = [];
    const pattern = new RegExp('^' + path.replace(/:(\w+)/g, (_, n: string) => (names.push(n), '([^/]+)')) + '$');
    return { method, pattern, names, handler };
  };

  return [
    r('GET', '/api/health', async () => ({ status: 200, body: { ok: true, service: 'stride-backend' } })),

    // ---- Sign-in. Microsoft sign-in is /.auth/login/aad (App Service), not an API route. ----
    r('GET', '/api/me', async (c) => ({ status: 200, body: await people.me(c.caller) })),
    r('POST', '/api/auth/invite', async (c) => {
      const account = await people.redeemInvite(str(c.body, 'code'), str(c.body, 'password'));
      return { status: 200, body: { ok: true, email: account.email }, headers: startSession(account.id) };
    }),
    r('POST', '/api/auth/login', async (c) => {
      const account = await people.signIn(str(c.body, 'email'), str(c.body, 'password'));
      return { status: 200, body: { ok: true }, headers: startSession(account.id) };
    }),
    r('POST', '/api/auth/logout', async () => ({
      status: 200,
      body: { ok: true },
      headers: { 'set-cookie': [cookie('', 0), `${DEV_UPN_COOKIE}=; Path=/; Max-Age=0`] },
    })),
    // Local development only (AUTH=dev): pretend to be an Entra user, since there is no App Service sign-in.
    r('POST', '/api/dev/login', async (c) => {
      if (!deps.devAuth) throw new HttpError(404, 'Not found');
      const upn = str(c.body, 'upn').trim().toLowerCase();
      return { status: 200, body: { ok: true }, headers: { 'set-cookie': `${DEV_UPN_COOKIE}=${encodeURIComponent(upn)}; Path=/; HttpOnly; SameSite=Lax` } };
    }),

    // ---- Teams ----
    // The Bot Connector posts Teams activities here. Authenticated by the bot's own JWT (see teams/bot/auth.ts);
    // App Service authentication skips this path (excludedPaths in infra/main.bicep).
    r('POST', '/api/messages', async (c) => {
      if (!deps.teams) throw new HttpError(404, 'Teams is not enabled');
      await deps.teams.handleBotRequest(c.authorization, c.body);
      return { status: 200, body: {} };
    }),
    r('GET', '/api/teams', async () => ({ status: 200, body: { enabled: !!deps.teams, tabLink: deps.teams?.tabLink ?? null } })),
    r('GET', '/api/teams/app-package', async (c) => {
      PeopleService.staff(c.caller); // signed-in managers and buddies only
      if (!deps.teams) throw new HttpError(404, 'Teams is not enabled');
      return { status: 200, body: null, file: { contentType: 'application/zip', data: await deps.teams.appPackage(), filename: 'stride-teams-app.zip' } };
    }),

    // ---- New colleague: saved app state and the shared thread ----
    r('GET', '/api/state', async (c) => ({ status: 200, body: await people.loadState(c.caller) })),
    r('PUT', '/api/state', async (c) => {
      const b = c.body as { state?: unknown; summary?: unknown } | null;
      return { status: 200, body: await people.saveState(c.caller, b?.state ?? null, b?.summary) };
    }),
    r('GET', '/api/notes', async (c) => ({ status: 200, body: await people.starterNotes(c.caller) })),
    r('POST', '/api/notes', async (c) => ({ status: 201, body: await people.postNote(c.caller, str(c.body, 'text')) })),

    // ---- Line managers and buddies (Entra) ----
    r('GET', '/api/starters', async (c) => ({ status: 200, body: await people.listMine(c.caller) })),
    r('POST', '/api/starters', async (c) => ({
      status: 201,
      body: await people.createStarter(c.caller, {
        firstName: str(c.body, 'firstName'),
        lastName: optStr(c.body, 'lastName') ?? '',
        email: str(c.body, 'email'),
        buddyUpn: optStr(c.body, 'buddyUpn'),
      }),
    })),
    r('GET', '/api/starters/:id', async (c) => ({ status: 200, body: await people.view(c.caller, c.params.id) })),
    r('POST', '/api/starters/:id/invite', async (c) => ({ status: 200, body: await people.reissueInvite(c.caller, c.params.id) })),
    r('POST', '/api/starters/:id/buddy', async (c) => ({ status: 200, body: await people.setBuddy(c.caller, c.params.id, optStr(c.body, 'buddyUpn')) })),
    r('POST', '/api/starters/:id/link', async (c) => ({ status: 200, body: await people.linkEntra(c.caller, c.params.id, str(c.body, 'upn')) })),
    r('POST', '/api/starters/:id/notes', async (c) => ({ status: 201, body: await people.postNote(c.caller, str(c.body, 'text'), c.params.id) })),

    r('POST', '/api/journey', async (c) => ({
      status: 201,
      body: await service.register(need(c.caller), str(c.body, 'firstName')),
    })),
    r('GET', '/api/journey', async (c) => ({ status: 200, body: await service.getJourney(need(c.caller)) })),
    r('POST', '/api/journey/open', async (c) => {
      const index = (c.body as { index?: unknown })?.index;
      if (typeof index !== 'number') throw new HttpError(400, '"index" must be a number');
      return { status: 200, body: await service.openPage(need(c.caller), index) };
    }),
    r('POST', '/api/journey/complete-page', async (c) => ({
      status: 200,
      body: await service.completePage(need(c.caller)),
    })),
    r('POST', '/api/journey/tasks/:taskId/toggle', async (c) => ({
      status: 200,
      body: await service.toggleTask(need(c.caller), c.params.taskId),
    })),
    r('GET', '/api/checklist', async () => ({ status: 200, body: CHECKLIST_IDS })),

    r('POST', '/api/consent', async (c) => {
      const body = c.body as { shareWithManager?: unknown; wordingVersion?: unknown };
      if (typeof body?.shareWithManager !== 'boolean' || typeof body.wordingVersion !== 'string') {
        throw new HttpError(400, '"shareWithManager" (boolean) and "wordingVersion" (string) are required');
      }
      return { status: 200, body: await service.setConsent(need(c.caller), body.shareWithManager, body.wordingVersion) };
    }),

    r('POST', '/api/teams/share', async (c) => ({ status: 201, body: await service.shareProgress(need(c.caller)) })),
    r('POST', '/api/teams/check-in', async (c) => {
      const b = c.body as { date?: unknown; time?: unknown; topic?: unknown };
      return {
        status: 201,
        body: await service.requestCheckIn(need(c.caller), {
          date: str(b, 'date'),
          time: str(b, 'time'),
          topic: typeof b.topic === 'string' ? b.topic : '',
        }),
      };
    }),
    r('POST', '/api/teams/question', async (c) => ({
      status: 201,
      body: await service.questionToManager(need(c.caller), str(c.body, 'question')),
    })),
    r('POST', '/api/teams/actions', async (c) => ({ status: 201, body: await service.notifyManagerOfActions(need(c.caller)) })),
    r('GET', '/api/teams/messages', async (c) => ({ status: 200, body: await service.listMessages(need(c.caller)) })),

    r('POST', '/api/chat', async (c) => ({ status: 201, body: await service.ask(need(c.caller), str(c.body, 'question')) })),
    r('GET', '/api/chat', async (c) => ({ status: 200, body: await service.listChat(need(c.caller)) })),

    // The starter's own view of what their manager can see. Managers use GET /api/starters/:id.
    r('GET', '/api/manager/summary', async (c) => ({ status: 200, body: await service.managerSummary(need(c.caller)) })),

    // Scheduled job endpoint. Protected by an admin token; Azure will call it from a timer trigger.
    r('POST', '/api/admin/catch-up', async (c) => {
      if (!isAdmin(deps.adminToken, c.adminToken)) throw new HttpError(403, 'Admin token required');
      return { status: 200, body: await runCatchUp(deps.store, service) };
    }),
    // Demo data (infra/seed-demo.sh). The app writes it with its own database access, so the person running the
    // script needs no database permissions. Writes straight to the store: nothing is sent to Teams.
    r('POST', '/api/admin/seed-demo', async (c) => {
      if (!isAdmin(deps.adminToken, c.adminToken)) throw new HttpError(403, 'Admin token required');
      const b = c.body as { managerUpn?: unknown; buddyUpn?: unknown; dryRun?: unknown } | null;
      const upn = (v: unknown, name: string) => {
        if (typeof v !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new HttpError(400, `${name} must be a UPN (name@domain)`);
        return v;
      };
      const target = b?.dryRun === true ? new MemoryStore() : deps.store;
      const rows = await seedDemo(target, { managerUpn: upn(b?.managerUpn, 'managerUpn'), buddyUpn: upn(b?.buddyUpn, 'buddyUpn'), now: deps.clock.now() });
      return { status: 200, body: { dryRun: b?.dryRun === true, rows } };
    }),
  ];
}

export async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 64 * 1024) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Body must be valid JSON');
  }
}
