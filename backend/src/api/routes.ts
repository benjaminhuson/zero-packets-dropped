// Section 1: HTTP routes. Thin: parse the request, call the service, return JSON.
import type { IncomingMessage } from 'node:http';
import type { JourneyService } from './service.js';
import { HttpError } from './service.js';
import { CHECKLIST_IDS } from './ids.js';
import { runCatchUp } from '../scheduler/reminders.js';
import type { Store } from '../contracts.js';

export interface RequestContext {
  method: string;
  path: string;
  params: Record<string, string>;
  body: unknown;
  userId: string | null;
  adminToken: string | null;
}

export type Handler = (ctx: RequestContext) => Promise<{ status: number; body: unknown }>;

export interface Deps {
  service: JourneyService;
  store: Store;
  adminToken: string | null;
}

function need(userId: string | null): string {
  // DEV ONLY: the caller identifies themselves with the x-user-id header.
  // TODO (section 5): replace with validated Entra ID tokens before any real use.
  if (!userId) throw new HttpError(401, 'Missing x-user-id header (dev auth). Entra ID comes later.');
  return userId;
}

function str(body: unknown, key: string): string {
  const v = (body as Record<string, unknown> | null)?.[key];
  if (typeof v !== 'string') throw new HttpError(400, `"${key}" must be a string`);
  return v;
}

export function buildRoutes(deps: Deps): { method: string; pattern: RegExp; names: string[]; handler: Handler }[] {
  const { service } = deps;
  const r = (method: string, path: string, handler: Handler) => {
    const names: string[] = [];
    const pattern = new RegExp('^' + path.replace(/:(\w+)/g, (_, n: string) => (names.push(n), '([^/]+)')) + '$');
    return { method, pattern, names, handler };
  };

  return [
    r('GET', '/api/health', async () => ({ status: 200, body: { ok: true, service: 'stride-backend' } })),

    r('POST', '/api/journey', async (c) => ({
      status: 201,
      body: await service.register(need(c.userId), str(c.body, 'firstName')),
    })),
    r('GET', '/api/journey', async (c) => ({ status: 200, body: await service.getJourney(need(c.userId)) })),
    r('POST', '/api/journey/open', async (c) => {
      const index = (c.body as { index?: unknown })?.index;
      if (typeof index !== 'number') throw new HttpError(400, '"index" must be a number');
      return { status: 200, body: await service.openPage(need(c.userId), index) };
    }),
    r('POST', '/api/journey/complete-page', async (c) => ({
      status: 200,
      body: await service.completePage(need(c.userId)),
    })),
    r('POST', '/api/journey/tasks/:taskId/toggle', async (c) => ({
      status: 200,
      body: await service.toggleTask(need(c.userId), c.params.taskId),
    })),
    r('GET', '/api/checklist', async () => ({ status: 200, body: CHECKLIST_IDS })),

    r('POST', '/api/consent', async (c) => {
      const body = c.body as { shareWithManager?: unknown; wordingVersion?: unknown };
      if (typeof body?.shareWithManager !== 'boolean' || typeof body.wordingVersion !== 'string') {
        throw new HttpError(400, '"shareWithManager" (boolean) and "wordingVersion" (string) are required');
      }
      return { status: 200, body: await service.setConsent(need(c.userId), body.shareWithManager, body.wordingVersion) };
    }),

    r('POST', '/api/teams/share', async (c) => ({ status: 201, body: await service.shareProgress(need(c.userId)) })),
    r('POST', '/api/teams/check-in', async (c) => {
      const b = c.body as { date?: unknown; time?: unknown; topic?: unknown };
      return {
        status: 201,
        body: await service.requestCheckIn(need(c.userId), {
          date: str(b, 'date'),
          time: str(b, 'time'),
          topic: typeof b.topic === 'string' ? b.topic : '',
        }),
      };
    }),
    r('POST', '/api/teams/question', async (c) => ({
      status: 201,
      body: await service.questionToManager(need(c.userId), str(c.body, 'question')),
    })),
    r('POST', '/api/teams/actions', async (c) => ({ status: 201, body: await service.notifyManagerOfActions(need(c.userId)) })),
    r('GET', '/api/teams/messages', async (c) => ({ status: 200, body: await service.listMessages(need(c.userId)) })),

    r('POST', '/api/chat', async (c) => ({ status: 201, body: await service.ask(need(c.userId), str(c.body, 'question')) })),
    r('GET', '/api/chat', async (c) => ({ status: 200, body: await service.listChat(need(c.userId)) })),

    // Manager-facing. Real access control (manager role check) comes with Entra ID.
    r('GET', '/api/manager/summary', async (c) => ({ status: 200, body: await service.managerSummary(need(c.userId)) })),

    // Scheduled job endpoint. Protected by an admin token; Azure will call it from a timer trigger.
    r('POST', '/api/admin/catch-up', async (c) => {
      if (!deps.adminToken || c.adminToken !== deps.adminToken) throw new HttpError(403, 'Admin token required');
      return { status: 200, body: await runCatchUp(deps.store, service) };
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
