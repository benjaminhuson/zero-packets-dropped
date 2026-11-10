// Entry point: wires the sections together and starts the HTTP server.
import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { JourneyService, HttpError } from './api/service.js';
import { PeopleService } from './api/people.js';
import { buildRoutes, readBody, type TeamsRoutes } from './api/routes.js';
import { resolveCaller } from './auth/caller.js';
import { serveStatic } from './static.js';
import { runCatchUp } from './scheduler/reminders.js';
import { MemoryStore } from './store/memory.js';
import { CosmosStore } from './store/cosmos.js';
import { MockTeamsGateway } from './teams/mock.js';
import { GraphTeamsGateway } from './teams/graph.js';
import { BotConnector, type Activity } from './teams/bot/connector.js';
import { verifyBotRequest } from './teams/bot/auth.js';
import { handleActivity } from './teams/bot/handler.js';
import { GraphMeetings } from './teams/meetings.js';
import { buildPackage, tabDeepLink } from './teams/package.js';
import { RulesAgent } from './agent/rules.js';
import { AiAgent } from './agent/ai.js';
import type { Caller, Clock, Store, TeamsGateway, AgentGateway } from './contracts.js';

const config = loadConfig();

const store: Store = config.store === 'memory' ? new MemoryStore() : new CosmosStore(config.cosmosEndpoint, config.cosmosDatabase);
const agent: AgentGateway = config.agent === 'rules' ? new RulesAgent() : new AiAgent();
const clock: Clock = { now: () => new Date() };

// Teams: the mock locally; in Azure, the Stride bot (Bot Connector) and, optionally, Graph for meetings.
let teams: TeamsGateway = new MockTeamsGateway();
let teamsRoutes: TeamsRoutes | null = null;
if (config.teams === 'graph') {
  const connector = new BotConnector(config.botAppId, config.tenantId);
  const meetings = config.meetings === 'graph' && config.entraClientId
    ? new GraphMeetings(config.tenantId, config.entraClientId, config.botAppId)
    : null;
  const tabLink = tabDeepLink(config.botAppId);
  teams = new GraphTeamsGateway({ store, connector, meetings, appUrl: tabLink });
  teamsRoutes = {
    tabLink,
    async handleBotRequest(authorization, body) {
      const activity = body as Activity | null;
      if (!activity || typeof activity !== 'object') throw new HttpError(400, 'Expected a Bot Framework activity');
      try {
        await verifyBotRequest(authorization, activity.serviceUrl, { appId: config.botAppId, tenantId: config.tenantId });
      } catch (err) {
        console.warn('bot request rejected:', err instanceof Error ? err.message : err);
        throw new HttpError(401, 'Unauthorized');
      }
      // Answer Teams straight away; do the work in the background.
      const postNote = (caller: Caller, starterId: string, text: string) => people.postNote(caller, text, starterId);
      void handleActivity(activity, { store, connector, appUrl: tabLink, now: clock.now, postNote }).catch((err) =>
        console.error('bot activity failed:', err instanceof Error ? err.message : err));
    },
    appPackage: () => buildPackage(
      { appUrl: config.appUrl, botAppId: config.botAppId, entraClientId: config.entraClientId, teamNumber: config.teamNumber },
      clock.now(),
    ),
  };
}

const service = new JourneyService(store, teams, agent, clock);
const people = new PeopleService(store, clock, config.teams === 'graph' ? teams : null);
const routes = buildRoutes({
  service,
  people,
  store,
  clock,
  adminToken: config.adminToken,
  sessionSecret: config.sessionSecret,
  secureCookies: config.auth === 'easyauth',
  devAuth: config.auth === 'dev',
  teams: teamsRoutes,
});
const authSettings = { mode: config.auth, sessionSecret: config.sessionSecret };

// Stride may be shown inside Teams (the personal tab), and nowhere else.
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'content-security-policy':
    "frame-ancestors 'self' https://teams.microsoft.com https://*.teams.microsoft.com https://teams.cloud.microsoft https://*.cloud.microsoft https://*.office.com",
};

const server = createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  const url = new URL(req.url ?? '/', 'http://localhost');
  const send = (status: number, body: unknown, headers: Record<string, string | string[]> = {}) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
    res.end(JSON.stringify(body));
  };
  try {
    if (!url.pathname.startsWith('/api/')) {
      if (config.staticDir && (req.method === 'GET' || req.method === 'HEAD')) return await serveStatic(config.staticDir, url.pathname, res);
      return send(404, { error: 'Not found' });
    }
    const match = routes
      .map((route) => ({ route, m: url.pathname.match(route.pattern) }))
      .find((x) => x.m && x.route.method === req.method);
    if (!match || !match.m) {
      const pathExists = routes.some((rt) => rt.pattern.test(url.pathname));
      return send(pathExists ? 405 : 404, { error: pathExists ? 'Method not allowed' : 'Not found' });
    }
    // Cross-site forms cannot send application/json without a CORS preflight, which we never allow.
    // Requiring it on every write stops cross-site request forgery against the session cookies.
    if (req.method !== 'GET' && req.method !== 'HEAD' && !(req.headers['content-type'] ?? '').startsWith('application/json')) {
      return send(415, { error: 'Send JSON (content-type: application/json)' });
    }
    const params = Object.fromEntries(match.route.names.map((n, i) => [n, decodeURIComponent(match.m![i + 1])]));
    const body = await readBody(req);
    const header = (name: string) => {
      const v = req.headers[name];
      return typeof v === 'string' ? v : null;
    };
    const caller = await resolveCaller(req.headers, store, authSettings, clock.now());
    const result = await match.route.handler({
      method: req.method ?? 'GET',
      path: url.pathname,
      params,
      body,
      caller,
      adminToken: header('x-admin-token'),
      authorization: header('authorization'),
    });
    if (result.file) {
      res.writeHead(result.status, {
        'content-type': result.file.contentType,
        'content-disposition': `attachment; filename="${result.file.filename}"`,
        'cache-control': 'no-store',
        ...result.headers,
      });
      return res.end(result.file.data);
    }
    send(result.status, result.body, result.headers);
  } catch (err) {
    if (err instanceof HttpError) return send(err.status, { error: err.message });
    console.error(err);
    send(500, { error: 'Something went wrong' });
  }
});

// Daily catch-up (weekly reminders, overdue nudges). In-process is enough for the PoC: the App Service
// has Always On, and the job is idempotent, so a restart or a second instance does no harm.
if (config.scheduler) {
  const run = () => runCatchUp(store, service).then((r) => console.log(`catch-up: ${r.users} users, ${r.sent} messages`)).catch(console.error);
  setTimeout(run, 60_000);
  setInterval(run, 24 * 3600_000);
}

server.listen(config.port, () => {
  console.log(`stride-backend listening on port ${config.port} (store=${config.store}, auth=${config.auth}, agent=${config.agent}, teams=${config.teams}, meetings=${config.meetings})`);
});
